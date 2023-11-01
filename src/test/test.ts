//import { Asset } from "stellar-sdk";
import { StellarService } from "../stellar_service/stellar.js";
import { Config, NetworkConfig, TestedVault } from "../config.js";
import { EventListener } from "../vault_service/event_listener.js"
import { VaultService } from "../vault_service/vault.js";
import { ApiManager, API } from "../vault_service/api.js";
import { Asset } from "stellar-sdk";
import { stellarHexToPublic, stellarPublicToHex } from "../stellar_service/convert.js";
import { serializeVaultId, deserializeVaultId } from "../vault_service/types.js";

type TestStatus = 'idle' | 'running';

export class Test {
    private instance_config: Config;
    private testStatuses: Map<string, TestStatus>;

    constructor(private stellarService: StellarService, config: Config, private apiManager: ApiManager) {
        this.instance_config = config;
        this.testStatuses = new Map<string, TestStatus>();
    }

    public async run() {
        let vaults = this.instance_config.getAllVaults();

        for (let i in vaults) {
            let vault = vaults[i];

            const serializedVaultID = serializeVaultId(vault.vault.id);

            // Check if a test is already running for this vault
            if (this.testStatuses.get(serializedVaultID) === 'running') {
                console.log(`Test for vault ${serializedVaultID} is already running.`);
                continue;
            }
            this.testStatuses.set(serializedVaultID, 'running');

            this.test_issuance(vault.network, vault.vault)
                .then((amount_issued) => this.test_redeem(amount_issued, vault.network, vault.vault))
                .catch((error) => this.handle_test_error(error))
                .finally(() => this.testStatuses.set(serializedVaultID, 'idle'));

        }
    }

    private async test_issuance(network: NetworkConfig, vault: TestedVault): Promise<number> {

        //TODO logic here to ensure that no test is initiated if issue (or request for that matter)
        //is initiated if another is in process
        console.log("initiating issue test");

        let api = await this.apiManager.getApi(network.name);
        let bridge_amount = this.instance_config.getBridgedAmount();

        let uri = this.instance_config.getSecretForNetwork(network.name);

        let vault_service = new VaultService(vault.id, api);
        //create the vault issuance

        let issueRequestEvent = await vault_service.request_issue(uri, bridge_amount);
        console.log("issue request executed");
        console.log(issueRequestEvent);

        //Ensure the asset and the Stellar vault's account are consistent with what we have in
        //the config
        let stellar_vault_account_from_event = issueRequestEvent.vault_stellar_public_key;
        if (vault.stellar_account != stellar_vault_account_from_event) {
            throw new Error("Inconsistent vault data Stellar account")
        }

        let asset = new Asset(issueRequestEvent.vault_id.currencies.wrapped.Stellar.AlphaNum4.code,
            issueRequestEvent.vault_id.currencies.wrapped.Stellar.AlphaNum4.issuer);

        //TODO what exactly is the memo? the request issue id throws error
        await this.stellarService.transfer(stellar_vault_account_from_event,
            String(bridge_amount),
            asset,
            network.stellar_mainnet,
            "hallo");

        //Wait for event of issuance
        const eventListener = EventListener.getEventListener(api.api);
        const max_waiting_time_ms = this.instance_config.getCompletionWindowMinutes() * 60 * 1000;
        const issueEvent = await eventListener.waitForIssueExecuteEvent(issueRequestEvent.issue_id, max_waiting_time_ms);

        console.log("issue succesfull");
        console.log(issueEvent);

        //Return the amount of issued tokens (bridged - Fee) that are free to redeem 
        return issueEvent.amount;
    }

    private async test_redeem(amount_issued: number, network: NetworkConfig, vault: TestedVault): Promise<void> {

        console.log("initiating redeem test");
        let asset_config = new Asset(vault.id.currencies.wrapped.Stellar.AlphaNum4.code, stellarHexToPublic(vault.id.currencies.wrapped.Stellar.AlphaNum4.issuer));
        let api = await this.apiManager.getApi(network.name);

        let uri = this.instance_config.getSecretForNetwork(network.name);
        let stellar_pk_bytes = this.instance_config.getStellarPublicKeyRaw(network.stellar_mainnet);

        let vault_service = new VaultService(vault.id, api);

        let redeemRequestEvent = await vault_service.request_redeem(uri, amount_issued, stellar_pk_bytes);
        console.log("redeem request executed");
        console.log(redeemRequestEvent);

        //Wait for event of redeem execution
        const eventListener = EventListener.getEventListener(api.api);
        const max_waiting_time_ms = this.instance_config.getTestDelayIntervalMinutes() * 60 * 1000;
        const redeemEvent = await eventListener.waitForRedeemExecuteEvent(redeemRequestEvent.redeem_id, max_waiting_time_ms);

        console.log("redeem succesfull");
        console.log(redeemEvent);

    }



    private handle_test_error(error: any) {
        console.log("Test Error");
        console.log(error);
    }

}

