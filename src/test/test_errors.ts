import { NetworkConfig } from "../config.js";
import { VaultID } from "../vault_service/types.js";
import { TestStage } from "./types.js";
import { SlackBlock, SlackBlockkitMessage } from "../slack_service/slack.js";

export abstract class TestError extends Error {
  constructor(message: string) {
    super(message);
  }

  abstract serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage;

  appendContext(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlock[] {
    const stageName: string = TestStage[stage];
    const context = `Error produced in test for network *${
      network.name
    }* in stage *${stageName}*: \n
                *Vault Id*: ${JSON.stringify(vaultId)} \n`;

    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Spacewalk Testing Service Error",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: context,
        },
      },
    ];
  }
}

export class RpcError extends TestError {
  constructor(
    message: string,
    private extrinsicCalled: string,
  ) {
    super(message);
    this.name = "RpcError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*When Calling Extrinsic*: ${this.extrinsicCalled}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}

export class TimeoutError extends TestError {
  id: string;

  constructor(message: string, id: string, extrinsicCalled: string) {
    super(message);
    this.name = "TimeoutError";
    this.id = id;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*Request ID*: ${this.id}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}

export class InconsistentConfigData extends TestError {
  data: object;

  constructor(message: string, data: object) {
    super(message);
    this.name = "InconsistentConfigData";
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*Data*: ${this.data}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}

export class InconsistentAmountError extends TestError {
  event: string;
  data: object;

  constructor(message: string, event: string, data: object) {
    super(message);
    this.name = "InconsistentAmountError";
    this.event = event;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Event*: ${this.event}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*Data*: ${this.data}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}

export class ExtrinsicFailedError extends TestError {
  eventName: string;

  constructor(message: string, eventName: string) {
    super(message);
    this.name = "ExtrinsicFailed";
    this.eventName = eventName;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*Event Name*: ${this.eventName}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}

export class MissingInBlockEventError extends TestError {
  eventName: string;

  constructor(message: string, eventName: string) {
    super(message);
    this.name = "MissingInBlockEvent";
    this.eventName = eventName;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*Event Name*: ${this.eventName}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}

export class TestDispatchError extends TestError {
  section: string;
  method: string;
  extrinsicCalled: string;

  constructor(
    message: string,
    method: string,
    section: string,
    extrinsicCalled: string,
  ) {
    super(message);
    this.name = "DispatchError";
    this.section = section;
    this.method = method;
    this.extrinsicCalled = extrinsicCalled;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*Dispatch Error*: ${this.extrinsicCalled}`,
        },
        {
          type: "mrkdwn",
          text: `*Error Section*: ${this.section}`,
        },
        {
          type: "mrkdwn",
          text: `*Error Method*: ${this.method}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}

export class StellarTransactionError extends TestError {
  type: string;
  extras: string;

  constructor(message: string, type: string, extras: string) {
    super(message);
    this.name = "StellarTransactionError";
    this.type = type;
    this.extras = extras;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*Transaction Type*: ${this.type}`,
        },
        {
          type: "mrkdwn",
          text: `*Info*: ${this.extras}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}

export class StellarAccountError extends TestError {
  account: string;

  constructor(message: string, account: string) {
    super(message);
    this.name = "StellarAccountError";
    this.account = account;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage,
  ): SlackBlockkitMessage {
    let context = this.appendContext(vaultId, network, stage);

    let errorBlock: SlackBlock = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Error Name*: ${this.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Message*: ${this.message}`,
        },
        {
          type: "mrkdwn",
          text: `*Attempted Account Id*: ${this.account}`,
        },
      ],
    };

    return {
      blocks: [...context, errorBlock],
    };
  }
}
