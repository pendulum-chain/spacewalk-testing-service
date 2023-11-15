import fs from "fs";
import path from "path";
import { Keypair } from "stellar-sdk";
import { VaultID } from "./vault_service/types.js";

export interface TestedVault {
  id: VaultID;
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
  networks: NetworkConfig[];
}

export interface RateLimitConfig {
  rateLimitWindowMinutes: number;
  rateLimitMaxRequests: number;
  rateLimitNumberOfProxies: number;
}

export class Config {
  private config: AppConfig;
  private rateLimitConfig: RateLimitConfig;
  private stellarMainnetKeypair: Keypair;
  private substrateAccountSecret: string;
  stellarTestnetKeypair: Keypair;

  constructor(filePath: string) {
    this.config = this.loadConfig(filePath);

    this.rateLimitConfig = {
      rateLimitWindowMinutes: parseInt(
        process.env.RATE_LIMIT_WINDOW_MINUTES || "1",
      ),
      rateLimitMaxRequests: parseInt(
        process.env.RATE_LIMIT_MAX_REQUESTS || "60",
      ),
      rateLimitNumberOfProxies: parseInt(
        process.env.RATE_LIMIT_NUMBER_OF_PROXIES || "1",
      ),
    };

    if (!process.env.STELLAR_ACCOUNT_SECRET_MAINNET) {
      throw new Error(
        "STELLAR_ACCOUNT_SECRET_MAINNET is not defined in the environment variables.",
      );
    }
    if (!process.env.STELLAR_ACCOUNT_SECRET_TESTNET) {
      throw new Error(
        "STELLAR_ACCOUNT_SECRET_TESTNET is not defined in the environment variables.",
      );
    }

    if (!process.env.SUBSTRATE_SECRET_PHRASE) {
      throw new Error(
        "SUBSTRATE_SECRET_PHRASE is not defined in the environment variables.",
      );
    }

    this.substrateAccountSecret = process.env.SUBSTRATE_SECRET_PHRASE;
    this.stellarMainnetKeypair = Keypair.fromSecret(
      process.env.STELLAR_ACCOUNT_SECRET_MAINNET,
    );
    this.stellarTestnetKeypair = Keypair.fromSecret(
      process.env.STELLAR_ACCOUNT_SECRET_TESTNET,
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

  public getRateLimitConfig(): RateLimitConfig {
    return this.rateLimitConfig;
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
    // We use the same secret for all networks
    return this.substrateAccountSecret;
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
