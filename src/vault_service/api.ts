import { ApiPromise, WsProvider } from "@polkadot/api";
import { Config, NetworkConfig } from '../config.js';

class ApiManager {
    private apiInstanceDict: { [key: string]: ApiPromise } = {};
    private config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    private async connectApi(socketUrl: string): Promise<ApiPromise> {
        const wsProvider = new WsProvider(socketUrl);
        return await ApiPromise.create({ provider: wsProvider, noInitWarn: true });
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

    public async getApi(network: string): Promise<ApiPromise> {
        if (!this.apiInstanceDict[network]) {
            await this.populateApis();
        }
        return this.apiInstanceDict[network];
    }
}

export { ApiManager, ApiPromise };