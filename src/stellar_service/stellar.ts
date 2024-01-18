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
  AccountResponse,
  Transaction,
  TimeoutInfinite,
  Horizon,
} from "stellar-sdk";
import {
  StellarTransactionError,
  StellarAccountError,
} from "../test/errors.js";
import { AxiosError } from "axios";
import ErrorResponseData = Horizon.ErrorResponseData;

export class StellarService {
  private mainnetServer: Server;
  private testnetServer: Server;
  private mainnetKeypair: Keypair;
  private testnetKeypair: Keypair;
  private mutex: Mutex;
  private initialBackoffDelay: number;
  private maxTransactionTimeBounds: number;

  constructor(mainnetSecret: string, testnetSecret: string) {
    if (!mainnetSecret || !testnetSecret) {
      throw new Error("Missing Stellar secret keys for mainnet and/or testnet");
    }
    if (
      !StrKey.isValidEd25519SecretSeed(mainnetSecret) ||
      !StrKey.isValidEd25519SecretSeed(testnetSecret)
    ) {
      throw new Error("Invalid Stellar secret keys for mainnet and/or testnet");
    }

    this.mainnetServer = new Server("https://horizon.stellar.org");
    this.testnetServer = new Server("https://horizon-testnet.stellar.org");
    this.mainnetKeypair = Keypair.fromSecret(mainnetSecret);
    this.testnetKeypair = Keypair.fromSecret(testnetSecret);
    this.mutex = new Mutex();
    this.initialBackoffDelay = 1000;
    // We set the max transaction time bounds to 30 minutes
    this.maxTransactionTimeBounds = 30 * 60;
  }

  public async transfer(
    destination: string,
    amount: string,
    asset: Asset,
    useMainnet: boolean,
    memo?: string,
  ): Promise<void> {
    console.log(
      `Sending ${amount} ${asset.code} to ${destination} with memo ${memo}`,
    );
    let server = useMainnet ? this.mainnetServer : this.testnetServer;
    let keys = useMainnet ? this.mainnetKeypair : this.testnetKeypair;
    const networkPassphrase = useMainnet ? Networks.PUBLIC : Networks.TESTNET;
    const unlock = await this.mutex.lock();

    // Load and validate destination account
    await this.loadAccount(destination, server);

    // Load source account
    let sourceAccount = await this.loadAccount(keys.publicKey(), server);

    try {
      const feeStatsResponse = await server.feeStats();
      // We use the 90th percentile fee to make sure we don't get a fee that is too low
      const fee = feeStatsResponse.fee_charged.p90;
      // Build the transaction
      let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: destination,
            asset: asset,
            amount,
          }),
        )
        .addMemo(Memo.text(memo || ""))
        .setTimeout(this.maxTransactionTimeBounds)
        .build();

      // Sign the transaction
      transaction.sign(keys);

      // Submit the transaction
      await this.submitWithRetry(
        server,
        transaction,
        this.initialBackoffDelay,
        async () => {
          // We unlock the mutex to avoid a deadlock
          unlock();
          return await this.transfer(
            destination,
            amount,
            asset,
            useMainnet,
            memo,
          );
        },
      );

      console.log(
        `Successfully sent ${amount} ${asset.code} to ${destination}`,
      );
    } catch (err) {
      if (this.isAxiosErrorWithExtras(err)) {
        const data = err.response!.data! as { extras: any };
        throw new StellarTransactionError(
          "Error while sending tokens to vault",
          "Payment",
          JSON.stringify(data.extras.result_codes),
        );
      } else if (err instanceof StellarTransactionError) {
        throw err;
      } else {
        // Handle other types of errors.
        console.log(err);
        throw new StellarTransactionError(
          "Error while sending tokens to vault",
          "Payment",
          "Unknown",
        );
      }
    } finally {
      unlock();
    }
  }

  private async submitWithRetry(
    server: Server,
    tx: Transaction,
    backoffDelay: number,
    // Callback to be called if the transaction fails due to a bad sequence number
    retryTransferCallback?: () => Promise<void>,
  ) {
    const expiration = parseInt(tx.timeBounds?.maxTime || "0");

    try {
      // Attempt to submit the transaction
      await server.submitTransaction(tx);
    } catch (error) {
      if (this.isHorizonTimeOutError(error) || this.isInternalError(error)) {
        // We will retry re-submitting the transaction as-is
        console.log(
          "Received a timeout or internal error from Horizon, retrying with the same transaction...",
          error.toString(),
        );

        // Check if the transaction has timed out, there is no point in
        // sending if it has expired
        if (Date.now() >= expiration * 1000) {
          throw new StellarTransactionError(
            "Error while sending tokens to vault due to timeout of tx timebounds",
            "Payment",
            "TX_TIMEBOUND_TIMEOUT",
          );
        }
        // We linearly increase the backoff delay
        backoffDelay = backoffDelay + 5000;
        await this.sleep(backoffDelay);

        await this.submitWithRetry(server, tx, backoffDelay);
      } else if (retryTransferCallback && this.isBadSequenceError(error)) {
        // We will retry re-submitting a new transaction with the correct sequence number
        console.log(
          `Received a bad sequence error from Horizon, retrying with a new transaction... Used sequence: ${tx.sequence}`,
        );
        await retryTransferCallback();
      } else if (
        retryTransferCallback &&
        (this.isBadSequenceError(error) || this.isInsufficientFeeError(error))
      ) {
        // We will retry re-submitting a new transaction with the latest feasible fee
        console.log(
          "Received an insufficient fee error from Horizon, retrying with a new transaction...",
          error.extras?.result_codes?.transaction,
        );
        await retryTransferCallback();
      } else {
        // If the transaction failed due to any other error, we don't retry
        throw error;
      }
    }
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async loadAccount(
    accountId: string,
    server: Server,
  ): Promise<AccountResponse> {
    let account: AccountResponse;
    try {
      account = await server.loadAccount(accountId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new StellarAccountError(
          `The Stellar account ${accountId} does not exist!`,
          accountId,
        );
      }
      throw new StellarAccountError("Unknown stellar account error", accountId);
    }

    return account;
  }

  // Get the balance of a given asset for the testing account of the
  // corresponding network
  public async getBalance(asset: Asset, mainnet: boolean): Promise<number> {
    let server = mainnet ? this.mainnetServer : this.testnetServer;
    let account: AccountResponse;
    if (mainnet) {
      account = await this.loadAccount(this.mainnetKeypair.publicKey(), server);
    } else {
      account = await this.loadAccount(this.testnetKeypair.publicKey(), server);
    }

    const _balance = account.balances.find((_asset) => {
      if (_asset.asset_type == "credit_alphanum4") {
        return (
          _asset.asset_code === asset.code &&
          _asset.asset_issuer === asset.issuer
        );
      } else {
        return false;
      }
    });
    return Number(_balance?.balance);
  }

  private isAxiosErrorWithExtras(error: any): error is AxiosError {
    return (
      error &&
      error.isAxiosError &&
      error.response &&
      error.response.data &&
      "extras" in error.response.data
    );
  }

  // See https://developers.stellar.org/api/horizon/errors/http-status-codes/horizon-specific/timeout
  private isHorizonTimeOutError(error: any): error is AxiosError {
    return (
      error &&
      error.isAxiosError &&
      error.response &&
      error.response.data &&
      error.response.data.status == 504
    );
  }

  // See https://developers.stellar.org/api/horizon/errors/result-codes/transactions
  private isBadSequenceError(
    error: any,
  ): error is ErrorResponseData.TransactionFailed {
    return (
      error &&
      error.isAxiosError &&
      error.response &&
      error.response.data &&
      error.response.data.status == 400 &&
      error.response.data?.extras?.result_codes?.transaction === "tx_bad_seq"
    );
  }

  // See https://developers.stellar.org/api/horizon/errors/result-codes/transactions
  private isInsufficientFeeError(
    error: any,
  ): error is ErrorResponseData.TransactionFailed {
    return (
      error &&
      error.isAxiosError &&
      error.response &&
      error.response.data &&
      error.response.data.status == 400 &&
      error.response.data?.extras?.result_codes?.transaction ===
        "tx_insufficient_fee"
    );
  }

  // See https://developers.stellar.org/api/horizon/errors/result-codes/transactions
  private isInternalError(
    error: any,
  ): error is ErrorResponseData.TransactionFailed {
    return (
      error &&
      error.isAxiosError &&
      error.response &&
      error.response.data &&
      error.response.data.status == 400 &&
      error.response.data?.extras?.result_codes?.transaction ===
        "tx_internal_error"
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

    this.lockPromise = new Promise<void>((resolve) => {
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
