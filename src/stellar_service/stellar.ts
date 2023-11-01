import { Server, Keypair, Asset, Networks, NotFoundError, Memo, BASE_FEE, TransactionBuilder, Operation, StrKey, AccountResponse } from 'stellar-sdk';

export class StellarService {
    private mainnetServer: Server;
    private testnetServer: Server;
    private mainnetKeypair: Keypair;
    private testnetKeypair: Keypair;
    private accountsCache: Map<string, AccountResponse> = new Map();

    constructor(mainnetSecret: string, testnetSecret: string) {
        this.mainnetServer = new Server('https://horizon.stellar.org');
        this.testnetServer = new Server('https://horizon-testnet.stellar.org');
        this.mainnetKeypair = Keypair.fromSecret(mainnetSecret);
        this.testnetKeypair = Keypair.fromSecret(testnetSecret);

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

        // Load and validate destination account
        await this.load_account(destination, server);

        // Load source account
        let sourceAccount = await this.load_account(keys.publicKey(), server);

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
            .setTimeout(180)
            .build();

        // Sign the transaction
        transaction.sign(keys);

        // Submit the transaction
        let result = await server.submitTransaction(transaction);

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
                throw new Error("The Stellar account does not exist!");
            }
            throw error;
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
}


