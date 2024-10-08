//import { Asset } from "stellar-sdk";
import { StellarService } from "../stellar_service/stellar.js";
import { Config, NetworkConfig, TestedVault } from "../config.js";
import { EventListener } from "../vault_service/event_listener.js";
import { VaultService } from "../vault_service/vault.js";
import { ApiManager, ApiComponents } from "../vault_service/api.js";
import { Asset } from "stellar-sdk";
import {
  serializeVaultId,
  deserializeVaultId,
  VaultID,
  prettyPrintVaultId,
} from "../vault_service/types.js";
import { SlackNotifier } from "../slack_service/slack.js";
import {
  TestError,
  InconsistentAmountError,
  InconsistentConfigData,
} from "./errors.js";
import { extractAssetFromWrapped } from "../vault_service/types.js";
import { TestStage } from "./types.js";
import {
  deriveShortenedRequestId,
  nativeStellarToDecimal,
} from "../stellar_service/convert.js";

export class Test {
  private instanceConfig: Config;
  testStages: Map<string, TestStage>;

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
        console.log(
          `Test already running for vault ${prettyPrintVaultId(
            vault.vault.id,
          )} at stage ${currentStage}`,
        );
        continue;
      }
      this.testStages.set(serializedVaultID, TestStage.TEST_INITIATED);

      // Initiate test cycle. Right after issue a redeem is executed with amount = issued amount
      // At any point any error is handled and sent to slack
      this.testIssuance(vault.network, vault.vault)
        .then((amountIssued) =>
          this.testRedeem(amountIssued, vault.network, vault.vault),
        )
        .then(() => {
          console.log(
            `Test completed successfully for vault ${prettyPrintVaultId(
              vault.vault.id,
            )} on network ${vault.network.name}`,
          );
        })
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
      `Testing the issuance of vault ${prettyPrintVaultId(
        vault.id,
      )} on network ${network.name}`,
    );
    // Test values
    const serializedVaultID = serializeVaultId(vault.id, network.name);
    let bridgeAmount = this.instanceConfig.getBridgedAmount();
    let uri = this.instanceConfig.getSecretForNetwork(network.name);
    let vaultService = new VaultService(
      vault.id,
      this.apiManager,
      network.name,
    );
    const apiComponents = await this.apiManager.getApiComponents(network.name);

    // Create issue request and wait for its confirmation event
    let issueRequestEvent = await vaultService.requestIssue(uri, bridgeAmount);
    this.testStages.set(serializedVaultID, TestStage.REQUEST_ISSUE_COMPLETED);
    console.log(
      `Successfully posed issue request ${
        issueRequestEvent.issueId
      } for vault ${prettyPrintVaultId(vault.id)} on network ${network.name}`,
    );

    let assetInfo = extractAssetFromWrapped(
      issueRequestEvent.vaultId.currencies.wrapped,
    );
    let asset =
      assetInfo.code === "XLM"
        ? Asset.native()
        : new Asset(assetInfo.code, assetInfo.issuer);

    // Convert bridge amount to decimal amount
    const stellarAmount = nativeStellarToDecimal(bridgeAmount).toString();

    const memo = deriveShortenedRequestId(issueRequestEvent.issueId);

    // Make the payment to the vault
    let stellarVaultAccountFromEvent = issueRequestEvent.vaultStellarPublicKey;
    await this.stellarService.transfer(
      stellarVaultAccountFromEvent,
      stellarAmount,
      asset,
      network.stellarMainnet,
      memo,
    );
    this.testStages.set(serializedVaultID, TestStage.STELLAR_PAYMENT_COMPLETED);

    //Wait for issue execution
    const eventListener = EventListener.getEventListener(apiComponents.api);
    const maxWaitingTimeMs =
      this.instanceConfig.getCompletionWindowMinutes() * 60 * 1000;
    const issueEvent = await eventListener.waitForIssueExecuteEvent(
      issueRequestEvent.issueId,
      maxWaitingTimeMs,
    );

    console.log(
      `Successfully issued ${issueEvent.amount} tokens on network ${
        network.name
      } for vault ${prettyPrintVaultId(vault.id)}`,
    );
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
      `Testing the redeem of vault ${prettyPrintVaultId(vault.id)} on network ${
        network.name
      } with amount ${amountIssued}`,
    );
    let api = await this.apiManager.getApiComponents(network.name);

    // Test values
    const serializedVaultID = serializeVaultId(vault.id, network.name);
    let uri = this.instanceConfig.getSecretForNetwork(network.name);
    let stellarPkBytes = this.instanceConfig.getStellarPublicKeyRaw(
      network.stellarMainnet,
    );
    let vaultService = new VaultService(
      vault.id,
      this.apiManager,
      network.name,
    );

    // Create redeem request and expect it's corresponding event
    let redeemRequestEvent = await vaultService.requestRedeem(
      uri,
      amountIssued,
      stellarPkBytes,
    );
    console.log(
      `Successfully posed redeem request ${
        redeemRequestEvent.redeemId
      } for vault ${prettyPrintVaultId(vault.id)} on network ${network.name}`,
    );
    this.testStages.set(serializedVaultID, TestStage.REQUEST_REDEEM_COMPLETED);

    // Wait for event of redeem execution
    const eventListener = EventListener.getEventListener(api.api);
    const maxWaitingTimeMs =
      this.instanceConfig.getCompletionWindowMinutes() * 60 * 1000;
    const redeemEvent = await eventListener.waitForRedeemExecuteEvent(
      redeemRequestEvent.redeemId,
      maxWaitingTimeMs,
    );

    console.log(
      `Successfully redeemed ${redeemEvent.amount} tokens on network ${
        network.name
      } for vault ${prettyPrintVaultId(vault.id)}`,
    );
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
      try {
        await this.slackNotifier.sendMessage(errorMessage);
      } catch (error) {
        console.log("Error sending message to slack", error);
      }
    }

    console.log(
      `Encountered error testing vault ${prettyPrintVaultId(
        vaultId,
      )} on network ${network.name}:`,
      error,
    );
  }

  public isTestRunning(): boolean {
    return this.testStages.size > 0;
  }
}
