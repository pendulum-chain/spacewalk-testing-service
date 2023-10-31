import { Server, Keypair, Asset, Networks, NotFoundError, Memo, BASE_FEE, TransactionBuilder, Operation, StrKey } from 'stellar-sdk';

export class StellarService {
    private mainnetServer: Server;
    private testnetServer: Server;
    private mainnetKeypair: Keypair;
    private testnetKeypair: Keypair;

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
        console.log(amount)
        // Load and validate destination account
        await server.loadAccount(destination).catch((error) => {
            if (error instanceof NotFoundError) {
                throw new Error("The destination account does not exist!");
            } else {
                throw error;
            }
        });
        // Load source account
        let sourceAccount = await server.loadAccount(keys.publicKey());

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
        console.log("Success! Results:", result);


    }
}


