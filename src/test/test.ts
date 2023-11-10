//import { Asset } from "stellar-sdk";
import { StellarService } from "../stellar_service/stellar.js";
import { Config, NetworkConfig, TestedVault } from "../config.js";
import { EventListener } from "../vault_service/event_listener.js";
import { VaultService } from "../vault_service/vault.js";
import { ApiManager, API } from "../vault_service/api.js";
import { Asset } from "stellar-sdk";
import {
  serializeVaultId,
  deserializeVaultId,
  VaultID,
} from "../vault_service/types.js";
import { SlackNotifier } from "../slack_service/slack.js";
import {
  TestError,
  InconsistentAmountError,
  InconsistentConfigData,
} from "./errors.js";
import { extractAssetCodeIssuerFromWrapped } from "../vault_service/types.js";
import { TestStage } from "./types.js";
import {
  deriveShortenedRequestId,
  hexToString,
  nativeStellarToDecimal,
} from "../stellar_service/convert.js";

export class Test {
  private instanceConfig: Config;
  private testStages: Map<string, TestStage>;

  constructor(
    private stellarService: StellarService,
    config: Config,
    private apiManager: ApiManager,
    private slackNotifier: SlackNotifier,
  ) {
    this.instanceConfig = config;
    this.testStages = new Map<string, TestStage>();
  }

  public async run(onCompletion: () => void) {
    let vaults = this.instanceConfig.getAllVaults();

    for (let i in vaults) {
      let vault = vaults[i];

      const serializedVaultID = serializeVaultId(
        vault.vault.id,
        vault.network.name,
      );

      // Check if a test is already running for this vault
      const currentStage = this.testStages.get(serializedVaultID);
      if (currentStage) {
        continue;
      }
      this.testStages.set(serializedVaultID, TestStage.TEST_INITIATED);

      // Initiate test cycle. Right after issue a redeem is executed with amount = issued amount
      // At any point any error is handled and sent to slack
      this.testIssuance(vault.network, vault.vault)
        .then((amountIssued) =>
          this.testRedeem(amountIssued, vault.network, vault.vault),
        )
        .catch(
          async (error) =>
            await this.handleTestError(error, vault.vault.id, vault.network),
        )
        .finally(() => {
          this.testStages.delete(serializedVaultID);
          onCompletion();
        });
    }
  }

  private async testIssuance(
    network: NetworkConfig,
    vault: TestedVault,
  ): Promise<number> {
    console.log(
      "Testing the issuance of vault",
      vault.id,
      "on network",
      network.name,
    );
    let api = await this.apiManager.getApi(network.name);

    // Test values
    const serializedVaultID = serializeVaultId(vault.id, network.name);
    let bridgeAmount = this.instanceConfig.getBridgedAmount();
    let uri = this.instanceConfig.getSecretForNetwork(network.name);
    let vaultService = new VaultService(vault.id, api);

    // Create issue request and wait for its confirmation event
    let issueRequestEvent = await vaultService.requestIssue(uri, bridgeAmount);
    this.testStages.set(serializedVaultID, TestStage.REQUEST_ISSUE_COMPLETED);
    console.log("Successfully posed issue request", issueRequestEvent);

    // Ensure the asset and the Stellar vault's account are consistent with what we have in
    // the config
    let stellarVaultAccountFromEvent = issueRequestEvent.vaultStellarPublicKey;
    if (vault.stellarAccount != stellarVaultAccountFromEvent) {
      throw new InconsistentConfigData(
        "Decoded Stellar vault's account does not match account from config",
        {
          stellarVaultAccountFromEvent,
          stellarVaultAccountFromConfig: vault.stellarAccount,
        },
      );
    }

    let assetInfo = extractAssetCodeIssuerFromWrapped(
      issueRequestEvent.vaultId.currencies.wrapped,
    );
    let asset = new Asset(assetInfo.code, assetInfo.issuer);

    // Convert bridge amount to decimal amount
    const stellarAmount = nativeStellarToDecimal(bridgeAmount).toString();

    const memo = deriveShortenedRequestId(issueRequestEvent.issueId);

    // Make the payment to the vault
    await this.stellarService.transfer(
      stellarVaultAccountFromEvent,
      stellarAmount,
      asset,
      network.stellarMainnet,
      memo,
    );
    this.testStages.set(serializedVaultID, TestStage.STELLAR_PAYMENT_COMPLETED);

    //Wait for issue execution
    const eventListener = EventListener.getEventListener(api.api);
    const maxWaitingTimeMs =
      this.instanceConfig.getCompletionWindowMinutes() * 60 * 1000;
    const issueEvent = await eventListener.waitForIssueExecuteEvent(
      issueRequestEvent.issueId,
      maxWaitingTimeMs,
    );

    console.log("Successfully issued", issueEvent);
    this.testStages.set(serializedVaultID, TestStage.ISSUE_COMPLETED);

    // Expect that issued amount requested is consistent with issued executed
    if (issueEvent.amount + issueEvent.fee < bridgeAmount) {
      throw new InconsistentAmountError(
        "Issue executed amount is less than requested",
        "Execute Issue",
        {
          attemptedBridgeAmount: bridgeAmount,
          issueEventAmount: issueEvent.amount,
          fee: issueEvent.fee,
        },
      );
    }
    //Return the amount of issued tokens (bridged - Fee) that are free to redeem
    return issueEvent.amount - issueEvent.fee;
  }

  private async testRedeem(
    amountIssued: number,
    network: NetworkConfig,
    vault: TestedVault,
  ): Promise<void> {
    console.log(
      "Testing the redeem of vault",
      vault.id,
      "on network",
      network.name,
    );
    console.log("Redeeming amount", amountIssued);
    let api = await this.apiManager.getApi(network.name);

    // Test values
    const serializedVaultID = serializeVaultId(vault.id, network.name);
    let uri = this.instanceConfig.getSecretForNetwork(network.name);
    let stellarPkBytes = this.instanceConfig.getStellarPublicKeyRaw(
      network.stellarMainnet,
    );
    let vaultService = new VaultService(vault.id, api);

    // Create redeem request and expect it's corresponding event
    let redeemRequestEvent = await vaultService.requestRedeem(
      uri,
      amountIssued,
      stellarPkBytes,
    );
    console.log("Successfully posed redeem request", redeemRequestEvent);
    this.testStages.set(serializedVaultID, TestStage.REQUEST_REDEEM_COMPLETED);

    // Wait for event of redeem execution
    const eventListener = EventListener.getEventListener(api.api);
    const maxWaitingTimeMs =
      this.instanceConfig.getCompletionWindowMinutes() * 60 * 1000;
    const redeemEvent = await eventListener.waitForRedeemExecuteEvent(
      redeemRequestEvent.redeemId,
      maxWaitingTimeMs,
    );

    console.log("Successfully redeemed", redeemEvent);
    this.testStages.set(serializedVaultID, TestStage.REDEEM_COMPLETED);

    // Expect that redeem amount requested is consistent with redeemed executed
    if (
      redeemEvent.amount + redeemEvent.transferFee + redeemEvent.fee <
      amountIssued
    ) {
      throw new InconsistentAmountError(
        "Redeem executed amount is less than requested",
        "Execute Redeem",
        {
          attemptedRedeemAmount: amountIssued,
          redeemEventAmount: redeemEvent.amount,
          fee: redeemEvent.fee,
          transferFee: redeemEvent.transferFee,
        },
      );
    }
  }

  private async handleTestError(
    error: Error,
    vaultId: VaultID,
    network: NetworkConfig,
  ) {
    const serializedVaultID = serializeVaultId(vaultId, network.name);
    // if we reach this test currentStage cannot be undefined
    const currentStage = this.testStages.get(serializedVaultID)!;

    if (error instanceof TestError) {
      const errorMessage = error.serializeForSlack(
        vaultId,
        network,
        currentStage,
      );
      await this.slackNotifier.sendMessage(errorMessage);
    }

    console.log(error);
    console.log("error is instance of TestError", error instanceof TestError);
  }

  public isTestRunning(): boolean {
    return this.testStages.size > 0;
  }
}
