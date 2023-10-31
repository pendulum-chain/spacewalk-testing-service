import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Keypair, StrKey } from 'stellar-sdk';
import { stellarPublicToHex } from './stellar_service/convert.js';
export interface AssetInfo {
    code: string;
    issuer: string;
}

export interface Collateral {
    XCM: number;
}

export interface Wrapped {
    Stellar: {
        AlphaNum4: AssetInfo;
    };
}

export interface Currencies {
    collateral: Collateral;
    wrapped: Wrapped;
}

export interface VaultID {
    accountId: string;
    currencies: Currencies;
}

export interface TestedVault {
    id: VaultID;
    stellar_account: string;
}

export interface NetworkConfig {
    name: string;
    wss: string;
    stellar_mainnet: boolean;
    tested_vaults: TestedVault[];
}

export interface Secrets {
    network_name: string;
    uri: string;
}
export interface AppConfig {
    completion_window_minutes: number;
    bridged_amount: number;
    test_delay_interval_minutes: number;
    parachain_secrets: Secrets[]
    networks: NetworkConfig[];
}

export class Config {
    private config: AppConfig;
    private stellar_testnet_keypair: Keypair;
    private stellar_mainnet_keypair: Keypair;

    constructor(filePath: string) {
        this.config = this.loadConfig(filePath);

        if (!process.env.STELLAR_ACCOUNT_SECRET_MAINNET) {
            throw new Error('STELLAR_ACCOUNT_SECRET_MAINNET is not defined in the environment variables.');
        }
        if (!process.env.STELLAR_ACCOUNT_SECRET_TESTNET) {
            throw new Error('STELLAR_ACCOUNT_SECRET_TESTNET is not defined in the environment variables.');
        }

        this.stellar_mainnet_keypair = Keypair.fromSecret(process.env.STELLAR_ACCOUNT_SECRET_MAINNET);
        this.stellar_testnet_keypair = Keypair.fromSecret(process.env.STELLAR_ACCOUNT_SECRET_TESTNET);


    }

    private loadConfig(filePath: string): AppConfig {
        try {
            const configPath = path.join(process.cwd(), filePath);
            const rawConfig = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(rawConfig) as AppConfig;
        } catch (error) {
            console.error(`Failed to load configuration from ${filePath}:`, error);
            process.exit(1);
        }
    }

    public getCompletionWindowMinutes(): number {
        return this.config.completion_window_minutes;
    }

    public getBridgedAmount(): number {
        return this.config.bridged_amount;
    }

    public getTestDelayIntervalMinutes(): number {
        return this.config.test_delay_interval_minutes;
    }

    public getNetworks(): NetworkConfig[] {
        return this.config.networks;
    }

    public getSecretForNetwork(network_name: string): string {
        let secret = this.config.parachain_secrets.find(function (el) {
            return el.network_name == network_name;
        });

        if (typeof secret === "undefined") {
            throw new Error("Secret for network is undefined.");
        }
        return secret.uri
    }

    public getStellarSecret(mainnet: boolean): string {
        if (mainnet) {
            return this.stellar_mainnet_keypair.secret();
        } else {
            return this.stellar_testnet_keypair.secret();
        }
    }

    public getStellarPublicKey(mainnet: boolean): string {
        if (mainnet) {
            return this.stellar_mainnet_keypair.publicKey();
        } else {
            return this.stellar_testnet_keypair.publicKey();
        }
    }

    public getStellarPublicKeyRaw(mainnet: boolean): Buffer {
        if (mainnet) {
            return this.stellar_mainnet_keypair.rawPublicKey();
        } else {
            return this.stellar_testnet_keypair.rawPublicKey();
        }
    }

    public getAllVaults(): Array<{ network: NetworkConfig, vault: TestedVault }> {
        const allVaults = [];

        for (const network of this.config.networks) {
            for (const vault of network.tested_vaults) {
                allVaults.push({
                    network,
                    vault
                });
            }
        }
        return allVaults;
    }
}