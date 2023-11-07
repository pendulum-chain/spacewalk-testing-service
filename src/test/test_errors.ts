import { NetworkConfig } from "../config.js";
import { VaultID } from "../vault_service/types.js";
import { TestStage } from "./types.js";
export abstract class TestError extends Error {
  constructor(message: string) {
    super(message);
  }

  abstract serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage
  ): string;

  appendContext(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage
  ): string {
    const stageName: string = TestStage[stage];
    return `## Error produced in test for: \n
                Network: ${network.name} \n
                Last Stage Completed: ${stageName} \n
                Vault Id: \`\`\`
                ${JSON.stringify(vaultId)}
                \`\`\` \n
                With Error: \n`;
  }
}

export class RpcError extends TestError {
  constructor(message: string, private extrinsicCalled: string) {
    super(message);
    this.name = "RpcError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  serializeForSlack(
    vaultId: VaultID,
    network: NetworkConfig,
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *When Calling Extrinsic*: ${this.extrinsicCalled}
        \`\`\``;
    return serializedText;
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
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Request id*: ${this.id}
        \`\`\``;
    return serializedText;
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
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Data*: ${JSON.stringify(this.data)}
        \`\`\``;
    return serializedText;
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
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Event*: ${this.event}
        *Message*: ${this.message}
        *Data*: ${JSON.stringify(this.data)}
        \`\`\``;
    return serializedText;
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
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *event_name*: ${this.eventName}
        \`\`\``;
    return serializedText;
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
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *event_name*: ${this.eventName}
        \`\`\``;
    return serializedText;
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
    extrinsicCalled: string
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
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Dispatch Error*: ${this.extrinsicCalled}
        *Error Section*: ${this.section}
        *Error Method*: ${this.method}
        \`\`\``;
    return serializedText;
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
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Transaction Type*: ${this.type}
        *Info*: ${this.extras}
        \`\`\``;
    return serializedText;
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
    stage: TestStage
  ): string {
    let serializedText = this.appendContext(vaultId, network, stage);
    serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Attempted Account Id*: ${this.account}
        \`\`\``;
    return serializedText;
  }
}
