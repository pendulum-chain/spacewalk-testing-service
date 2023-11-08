import ExpressConfig from "./express/express.config.js";
import { StellarService } from "./stellar_service/stellar.js";
import { Scheduler } from "./scheduler/scheduler.js";
import { Test } from "./test/test.js";
import { ApiManager } from "./vault_service/api.js";
import dotenv from "dotenv";
import { SlackNotifier } from "./slack_service/slack.js";

dotenv.config();

const app = ExpressConfig();
const PORT = process.env.PORT || 5000;

import { Config } from "./config.js";

const slackService = new SlackNotifier();
const config = new Config("config.json");
const apiManager = new ApiManager(config);
await apiManager.populateApis();
const stellarService = new StellarService(
  process.env.STELLAR_ACCOUNT_SECRET_MAINNET || "",
  process.env.STELLAR_ACCOUNT_SECRET_TESTNET || "",
);
const test = new Test(stellarService, config, apiManager, slackService);

const scheduler = new Scheduler(test, config.getTestDelayIntervalMinutes());

scheduler.start();

process.on("SIGINT", async () => {
  console.log("Received shutdown signal.");
  scheduler.shutdown();
});

app.listen(PORT, () => console.log("Server Running on Port " + PORT));
