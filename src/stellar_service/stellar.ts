import {
    Server,
    Keypair,
    Asset,
    Networks,
    NotFoundError,
    Memo,
    BASE_FEE,
    TransactionBuilder,
    Operation,
    StrKey,
    AccountResponse
} from 'stellar-sdk';
import {StellarTransactionError, StellarAccountError} from '../test/test_errors.js';
import {AxiosError} from 'axios';

export class StellarService {
    private mainnetServer: Server;
    private testnetServer: Server;
    private mainnetKeypair: Keypair;
    private testnetKeypair: Keypair;
    private accountsCache: Map<string, AccountResponse> = new Map();
    private mutex: Mutex;

    constructor(mainnetSecret: string, testnetSecret: string) {
        if (!mainnetSecret || !testnetSecret) {
            throw new Error("Missing Stellar secret keys for mainnet and/or testnet")
        }
        if (!StrKey.isValidEd25519SecretSeed(mainnetSecret) || !StrKey.isValidEd25519SecretSeed(testnetSecret)) {
            throw new Error("Invalid Stellar secret keys for mainnet and/or testnet")
        }

        this.mainnetServer = new Server('https://horizon.stellar.org');
        this.testnetServer = new Server('https://horizon-testnet.stellar.org');
        this.mainnetKeypair = Keypair.fromSecret(mainnetSecret);
        this.testnetKeypair = Keypair.fromSecret(testnetSecret);
        this.mutex = new Mutex();
        // Potentially validate that the accounts exist and have sufficient balance
    }

    public async transfer(
        destination: string,
        amount: string,
        asset: Asset,
        useMainnet: boolean,
        memo?: string
    ): Promise<void> {
        let server = useMainnet ? this.mainnetServer : this.testnetServer;
        let keys = useMainnet ? this.mainnetKeypair : this.testnetKeypair;
        const networkPassphrase = useMainnet ? Networks.PUBLIC : Networks.TESTNET;
        const unlock = await this.mutex.lock();

        // Load and validate destination account
        await this.load_account(destination, server);

        // Load source account
        let sourceAccount = await this.load_account(keys.publicKey(), server);

        console.log("Sending", amount, asset.code, asset.issuer, "to", destination, "with memo", memo)

        try {
            // Build the transaction
            let transaction = new TransactionBuilder(sourceAccount, {
                fee: BASE_FEE,
                networkPassphrase,
            })
                .addOperation(Operation.payment({
                    destination: destination,
                    asset: asset,
                    amount,
                }))
                .addMemo(Memo.text(memo || ""))
                .setTimeout(360)
                .build();

            // Sign the transaction
            transaction.sign(keys);

            // Submit the transaction

            let result = await server.submitTransaction(transaction);
            return
        } catch (err) {
            if (this.isAxiosErrorWithExtras(err)) {
                const data = err.response!.data! as { extras: any };
                throw new StellarTransactionError("Error while sending tokens to vault", "Payment", JSON.stringify(data.extras.result_codes))
            } else if (this.isTimeOut(err)) {
                throw new StellarTransactionError("Error while sending tokens to vault due to timeout", "Payment", "TIMEOUT")
            } else {
                // Handle other types of errors.
                console.log(err)
                throw new StellarTransactionError("Error while sending tokens to vault", "Payment", "Unknown")
            }
        } finally {
            unlock();
        }


    }

    private async load_account(accountId: string, server: Server): Promise<AccountResponse> {
        if (this.accountsCache.has(accountId)) {
            return this.accountsCache.get(accountId)!;
        }

        let account: AccountResponse;
        try {
            account = await server.loadAccount(accountId);
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw new StellarAccountError("The Stellar account does not exist!", accountId);
            }
            throw new StellarAccountError("Unknown stellar account error", accountId);
        }

        this.accountsCache.set(accountId, account);
        return account;
    }

    // Get the balance of a given asset for the testing account of the 
    // corresponding network
    public async get_balance(asset: Asset, mainnet: boolean): Promise<number> {
        let server = mainnet ? this.mainnetServer : this.testnetServer;
        let account: AccountResponse;
        if (mainnet) {
            account = await this.load_account(this.mainnetKeypair.publicKey(), server)
        } else {
            account = await this.load_account(this.testnetKeypair.publicKey(), server)
        }

        const _balance = account.balances.find((_asset) => {
            if (_asset.asset_type == 'credit_alphanum4') {
                return _asset.asset_code === asset.code && _asset.asset_issuer === asset.issuer
            } else {
                return false;
            }
        });
        return Number(_balance?.balance)
    }

    private isAxiosErrorWithExtras(error: any): error is AxiosError {
        return (
            error &&
            error.isAxiosError &&
            error.response &&
            error.response.data &&
            'extras' in error.response.data
        );
    }

    private isTimeOut(error: any): error is AxiosError {
        return (
            error &&
            error.isAxiosError &&
            error.response &&
            error.response.data &&
            error.response.data.status == 504
        );
    }
}


class Mutex {
    private lockPromise: Promise<void> | null = null;
    private resolveLock: (() => void) | null = null;

    async lock(): Promise<() => void> {
        while (this.lockPromise) {
            await this.lockPromise;
        }

        this.lockPromise = new Promise<void>(resolve => {
            this.resolveLock = resolve;
        });

        return () => {
            if (this.resolveLock) {
                this.resolveLock();
                this.lockPromise = null;
                this.resolveLock = null;
            }
        };
    }
}