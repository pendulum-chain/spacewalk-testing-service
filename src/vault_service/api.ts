import { ApiPromise, WsProvider } from "@polkadot/api";
import { Config, NetworkConfig } from '../config.js';

export type API = {
    api: ApiPromise;
    mutex: Mutex;
}

class ApiManager {
    private apiInstanceDict: { [key: string]: API } = {};
    private config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    private async connectApi(socketUrl: string): Promise<API> {
        const wsProvider = new WsProvider(socketUrl);
        const api = await ApiPromise.create({ provider: wsProvider, noInitWarn: true });
        const mutex = new Mutex();
        return { api, mutex };
    }

    public async populateApis(): Promise<void> {
        const networks: NetworkConfig[] = this.config.getNetworks();

        for (const networkConfig of networks) {
            if (!this.apiInstanceDict[networkConfig.name]) {
                console.log(`Connecting to node ${networkConfig.wss}...`);
                this.apiInstanceDict[networkConfig.name] = await this.connectApi(networkConfig.wss);
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
}

class Mutex {
    private locks: Map<string, Promise<void>> = new Map();

    async lock(accountId: string): Promise<() => void> {
        let resolveLock;
        const lockPromise = new Promise<void>(resolve => {
            resolveLock = resolve;
        });

        const prevLock = this.locks.get(accountId) || Promise.resolve();
        this.locks.set(accountId, prevLock.then(() => lockPromise));

        await prevLock;

        return () => {
            resolveLock!();
        };
    }
}


export { ApiManager, ApiPromise };