//import { Asset } from "stellar-sdk";
import {StellarService} from "../stellar_service/stellar.js";
import {Config, NetworkConfig, TestedVault} from "../config.js";
import {EventListener} from "../vault_service/event_listener.js"
import {VaultService} from "../vault_service/vault.js";
import {ApiManager, API} from "../vault_service/api.js";
import {Asset} from "stellar-sdk";
import {serializeVaultId, deserializeVaultId, VaultID} from "../vault_service/types.js";
import {SlackNotifier} from "../slack_service/slack.js";
import {TestError, InconsistentAmountError, InconsistentConfigData} from "./test_errors.js";
import {extractAssetCodeIssuerFromWrapped} from "../vault_service/types.js";
import {TestStage} from "./types.js";
import {deriveShortenedRequestId, hexToString, nativeStellarToDecimal} from "../stellar_service/convert.js";

export class Test {
    private instance_config: Config;
    private testStages: Map<string, TestStage>;

    constructor(private stellarService: StellarService, config: Config, private apiManager: ApiManager, private slackNotifier: SlackNotifier) {
        this.instance_config = config;
        this.testStages = new Map<string, TestStage>();
    }

    public async run(onCompletion: () => void) {
        let vaults = this.instance_config.getAllVaults();

        for (let i in vaults) {
            let vault = vaults[i];

            const serializedVaultID = serializeVaultId(vault.vault.id, vault.network.name);

            // Check if a test is already running for this vault
            const currentStage = this.testStages.get(serializedVaultID);
            if (currentStage) {
                continue;

            }
            this.testStages.set(serializedVaultID, TestStage.TEST_INITIATED);

            // Initiate test cycle. Right after issue a redeem is executed with amount = issued amount
            // At any point any error is handled and sent to slack
            this.test_issuance(vault.network, vault.vault)
                .then((amount_issued) => this.test_redeem(amount_issued, vault.network, vault.vault))
                .catch(async (error) => await this.handle_test_error(error, vault.vault.id, vault.network))
                .finally(() => {
                    this.testStages.delete(serializedVaultID);
                    onCompletion();
                });

        }
    }

    private async test_issuance(network: NetworkConfig, vault: TestedVault): Promise<number> {
        console.log("Testing the issuance of vault", vault.id, "on network", network.name)
        let api = await this.apiManager.getApi(network.name);

        // Test values
        const serializedVaultID = serializeVaultId(vault.id, network.name);
        let bridge_amount = this.instance_config.getBridgedAmount();
        let uri = this.instance_config.getSecretForNetwork(network.name);
        let vault_service = new VaultService(vault.id, api);

        // Create issue request and wait for its confirmation event
        let issueRequestEvent = await vault_service.request_issue(uri, bridge_amount);
        this.testStages.set(serializedVaultID, TestStage.REQUEST_ISSUE_COMPLETED);
        console.log("Successfully posed issue request", issueRequestEvent);

        // Ensure the asset and the Stellar vault's account are consistent with what we have in
        // the config
        let stellar_vault_account_from_event = issueRequestEvent.vault_stellar_public_key;
        if (vault.stellar_account != stellar_vault_account_from_event) {
            throw new InconsistentConfigData("Decoded Stellar vault's account does not match account from config", {
                stellar_vault_account_from_event,
                stellar_vault_account_from_config: vault.stellar_account
            })
        }

        let asset_info = extractAssetCodeIssuerFromWrapped(issueRequestEvent.vault_id.currencies.wrapped);
        let asset = new Asset(asset_info.code, asset_info.issuer);

        // Convert bridge amount to decimal amount
        const stellarAmount = nativeStellarToDecimal(bridge_amount).toString();

        const memo = deriveShortenedRequestId(issueRequestEvent.issue_id);

        // Make the payment to the vault
        await this.stellarService.transfer(stellar_vault_account_from_event,
            stellarAmount,
            asset,
            network.stellar_mainnet,
            memo
        );
        this.testStages.set(serializedVaultID, TestStage.STELLAR_PAYMENT_COMPLETED);

        //Wait for issue execution
        const eventListener = EventListener.getEventListener(api.api);
        const max_waiting_time_ms = this.instance_config.getCompletionWindowMinutes() * 60 * 1000;
        const issueEvent = await eventListener.waitForIssueExecuteEvent(issueRequestEvent.issue_id, max_waiting_time_ms);

        console.log("Successfully issued", issueEvent)
        this.testStages.set(serializedVaultID, TestStage.ISSUE_COMPLETED);

        // Expect that issued amount requested is consistent with issued executed
        if ((issueEvent.amount + issueEvent.fee) < bridge_amount) {
            throw new InconsistentAmountError("Issue executed amount is less than requested", "Execute Issue", {
                attempted_bridge_amount: bridge_amount,
                issue_event_amount: issueEvent.amount,
                fee: issueEvent.fee
            })
        }
        //Return the amount of issued tokens (bridged - Fee) that are free to redeem 
        return issueEvent.amount - issueEvent.fee;
    }

    private async test_redeem(amount_issued: number, network: NetworkConfig, vault: TestedVault): Promise<void> {
        console.log("Testing the redeem of vault", vault.id, "on network", network.name)
        console.log("Redeeming amount", amount_issued)
        let api = await this.apiManager.getApi(network.name);

        // Test values
        const serializedVaultID = serializeVaultId(vault.id, network.name);
        let uri = this.instance_config.getSecretForNetwork(network.name);
        let stellar_pk_bytes = this.instance_config.getStellarPublicKeyRaw(network.stellar_mainnet);
        let vault_service = new VaultService(vault.id, api);

        // Create redeem request and expect it's corresponding event
        let redeemRequestEvent = await vault_service.request_redeem(uri, amount_issued, stellar_pk_bytes);
        console.log("Successfully posed redeem request", redeemRequestEvent);
        this.testStages.set(serializedVaultID, TestStage.REQUEST_REDEEM_COMPLETED);

        // Wait for event of redeem execution
        const eventListener = EventListener.getEventListener(api.api);
        const max_waiting_time_ms = this.instance_config.getCompletionWindowMinutes() * 60 * 1000;
        const redeemEvent = await eventListener.waitForRedeemExecuteEvent(redeemRequestEvent.redeem_id, max_waiting_time_ms);

        console.log("Successfully redeemed", redeemEvent);
        this.testStages.set(serializedVaultID, TestStage.REDEEM_COMPLETED);

        // Expect that redeem amount requested is consistent with redeemed executed
        if ((redeemEvent.amount + redeemEvent.transfer_fee + redeemEvent.fee) < amount_issued) {
            throw new InconsistentAmountError("Redeem executed amount is less than requested", "Execute Redeem", {
                attempted_redeem_amount: amount_issued,
                redeem_event_amount: redeemEvent.amount,
                fee: redeemEvent.fee,
                transfer_fee: redeemEvent.transfer_fee
            })
        }

    }

    private async handle_test_error(error: Error, vault_id: VaultID, network: NetworkConfig) {
        const serializedVaultID = serializeVaultId(vault_id, network.name);
        // if we reach this test currentStage cannot be undefined 
        const currentStage = this.testStages.get(serializedVaultID)!;

        if (error instanceof TestError)
            await this.slackNotifier.send_message(error.serializeForSlack(vault_id, network, currentStage))

        console.log(error);
    }

    public isTestRunning(): boolean {
        return this.testStages.size > 0;
    }
}

