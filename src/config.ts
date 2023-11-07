import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Keypair, StrKey } from "stellar-sdk";
import { stellarPublicToHex } from "./stellar_service/convert.js";
import { VaultID } from "./vault_service/types.js";
export interface TestedVault {
  id: VaultID;
  stellarAccount: string;
}

export interface NetworkConfig {
  name: string;
  wss: string;
  stellarMainnet: boolean;
  testedVaults: TestedVault[];
}

export interface Secrets {
  networkName: string;
  uri: string;
}
export interface AppConfig {
  completionWindowMinutes: number;
  bridgedAmount: number;
  testDelayIntervalMinutes: number;
  parachainSecrets: Secrets[];
  networks: NetworkConfig[];
}

export class Config {
  private config: AppConfig;
  private stellarTestnetKeypair: Keypair;
  private stellarMainnetKeypair: Keypair;

  constructor(filePath: string) {
    this.config = this.loadConfig(filePath);

    if (!process.env.STELLAR_ACCOUNT_SECRET_MAINNET) {
      throw new Error(
        "STELLAR_ACCOUNT_SECRET_MAINNET is not defined in the environment variables."
      );
    }
    if (!process.env.STELLAR_ACCOUNT_SECRET_TESTNET) {
      throw new Error(
        "STELLAR_ACCOUNT_SECRET_TESTNET is not defined in the environment variables."
      );
    }

    this.stellarMainnetKeypair = Keypair.fromSecret(
      process.env.STELLAR_ACCOUNT_SECRET_MAINNET
    );
    this.stellarTestnetKeypair = Keypair.fromSecret(
      process.env.STELLAR_ACCOUNT_SECRET_TESTNET
    );
    this.validateNetworkSecrets();
  }

  private loadConfig(filePath: string): AppConfig {
    try {
      const configPath = path.join(process.cwd(), filePath);
      const rawConfig = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(rawConfig) as AppConfig;
    } catch (error) {
      console.error(`Failed to load configuration from ${filePath}:`, error);
      process.exit(1);
    }
  }

  public getCompletionWindowMinutes(): number {
    return this.config.completionWindowMinutes;
  }

  public getBridgedAmount(): number {
    return this.config.bridgedAmount;
  }

  public getTestDelayIntervalMinutes(): number {
    return this.config.testDelayIntervalMinutes;
  }

  public getNetworks(): NetworkConfig[] {
    return this.config.networks;
  }

  public getSecretForNetwork(networkName: string): string {
    let secret = this.config.parachainSecrets.find(function (el) {
      return el.networkName == networkName;
    });

    return secret!.uri;
  }

  private validateNetworkSecrets() {
    for (const network of this.config.networks) {
      try {
        this.getSecretForNetwork(network.name);
      } catch {
        throw new Error(`URI for network ${network.name} is undefined`);
      }
    }
  }

  public getStellarSecret(mainnet: boolean): string {
    if (mainnet) {
      return this.stellarMainnetKeypair.secret();
    } else {
      return this.stellarTestnetKeypair.secret();
    }
  }

  public getStellarPublicKey(mainnet: boolean): string {
    if (mainnet) {
      return this.stellarMainnetKeypair.publicKey();
    } else {
      return this.stellarTestnetKeypair.publicKey();
    }
  }

  public getStellarPublicKeyRaw(mainnet: boolean): Buffer {
    if (mainnet) {
      return this.stellarMainnetKeypair.rawPublicKey();
    } else {
      return this.stellarTestnetKeypair.rawPublicKey();
    }
  }

  public getAllVaults(): Array<{ network: NetworkConfig; vault: TestedVault }> {
    const allVaults = [];

    for (const network of this.config.networks) {
      for (const vault of network.testedVaults) {
        allVaults.push({
          network,
          vault,
        });
      }
    }
    return allVaults;
  }
}
