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
import {
  deserializeVaultId,
  prettyPrintVaultId,
} from "./vault_service/types.js";
import { stageExplanation } from "./test/types.js";

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

/// Return the status of the tests
app.get("/status", (req, res) => {
  const isTestRunning = scheduler.test.isTestRunning();
  const testStages = scheduler.test.testStages;

  // Craft a long response string with all vault statuses
  let responseString = "<h1>Spacewalk Testing Service</h1>";

  // List all tested vaults
  responseString += `<h3>Tested Vaults</h3>`;
  let testedVaults = config.getAllVaults();
  responseString += `<table style="border-spacing: 8px">`;
  responseString += `<tr><th>Network</th><th>Vault Id</th></tr>`;
  for (let i in testedVaults) {
    let vault = testedVaults[i];
    responseString += `<tr><td>${
      vault.network.name
    }</td><td>${prettyPrintVaultId(vault.vault.id)}</td></tr>`;
  }
  responseString += `</table>`;

  // Print config details
  responseString += `<h3>Config</h3>`;
  responseString += `Completion window for each test stage: ${config.getCompletionWindowMinutes()} minutes <br />`;
  responseString += `Time between scheduled tests: ${config.getTestDelayIntervalMinutes()} minutes <br />`;
  responseString += `Stellar account (testnet): ${config.getStellarPublicKey(
    false,
  )}<br />`;
  responseString += `Stellar account (mainnet): ${config.getStellarPublicKey(
    true,
  )}<br />`;

  responseString += `<h3>Pending Tests (running: ${isTestRunning})</h3>`;
  if (scheduler.lastTestStarted) {
    responseString += `<p>Last test started at ${scheduler.lastTestStarted.toLocaleString()}</p>`;
  }
  if (scheduler.lastTestCompleted) {
    responseString += `<p>Last test completed at ${scheduler.lastTestCompleted.toLocaleString()}</p>`;
  }
  // Create simple html table for pending tests
  responseString += `<table style="border-spacing: 8px">`;
  responseString += `<tr><th>Network</th><th>Vault Id</th><th>Test Stage</th><th>Explanation</th></tr>`;
  for (let [serializedVaultId, testStage] of testStages) {
    const { vaultId, networkName } = deserializeVaultId(serializedVaultId);
    responseString += `<tr><td>${networkName}</td><td>${prettyPrintVaultId(
      vaultId,
    )}</td><td>${testStage}</td><td>${stageExplanation[testStage]}</td></tr>`;
  }
  responseString += `</table>`;

  res.send(responseString);
});

app.listen(PORT, () => console.log("Server Running on Port " + PORT));
