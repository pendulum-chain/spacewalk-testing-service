import { ApiPromise, WsProvider } from "@polkadot/api";
import { Config, NetworkConfig } from "../config.js";

export type API = {
  api: ApiPromise;
  mutex: Mutex;
  ss58Format: number;
};

class ApiManager {
  private apiInstanceDict: { [key: string]: API } = {};
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private async connectApi(socketUrl: string): Promise<API> {
    const wsProvider = new WsProvider(socketUrl);
    const api = await ApiPromise.create({
      provider: wsProvider,
      noInitWarn: true,
    });
    const mutex = new Mutex();

    const chainProperties = await api.registry.getChainProperties();
    const ss58Format = Number(
      chainProperties?.get("ss58Format").toString() || 42,
    );

    return { api, mutex, ss58Format };
  }

  public async populateApis(): Promise<void> {
    const networks: NetworkConfig[] = this.config.getNetworks();

    for (const networkConfig of networks) {
      if (!this.apiInstanceDict[networkConfig.name]) {
        console.log(`Connecting to node ${networkConfig.wss}...`);
        this.apiInstanceDict[networkConfig.name] = await this.connectApi(
          networkConfig.wss,
        );
        console.log(`Connected to node ${networkConfig.wss}`);
      }
    }
  }

  public async getApi(network: string): Promise<API> {
    if (!this.apiInstanceDict[network]) {
      await this.populateApis();
    }
    return this.apiInstanceDict[network];
  }

  public async executeApiCall(
    network: string,
    apiCall: (apiCall: ApiPromise) => Promise<any>,
  ): Promise<any> {
    let apiInstance = await this.getApi(network);

    try {
      return await apiCall(apiInstance.api);
    } catch (initialError: any) {
      // Only retry if the error is regarding bad signature error
      if (
        initialError.name === "RpcError" &&
        initialError.message.includes("Transaction has a bad signature")
      ) {
        console.log(`Error encountered, attempting to refresh the api...`);
        try {
          const networkConfig = this.config
            .getNetworks()
            .find((n) => n.name === network);
          const wss = networkConfig?.wss;
          if (!wss) {
            throw new Error(`No wss found for network ${network}`);
          }

          apiInstance = await this.connectApi(wss);
          this.apiInstanceDict["network"] = apiInstance;
          return await apiCall(apiInstance.api);
        } catch (retryError) {
          throw retryError;
        }
      } else {
        throw initialError;
      }
    }
  }
}

class Mutex {
  private locks: Map<string, Promise<void>> = new Map();

  async lock(accountId: string): Promise<() => void> {
    let resolveLock;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    const prevLock = this.locks.get(accountId) || Promise.resolve();
    this.locks.set(
      accountId,
      prevLock.then(() => lockPromise),
    );

    await prevLock;

    return () => {
      resolveLock!();
    };
  }
}

export { ApiManager, ApiPromise };
