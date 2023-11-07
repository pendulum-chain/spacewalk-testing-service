import { NetworkConfig } from "../config.js";
import { VaultID } from "../vault_service/types.js";
import { TestStage } from "./types.js";
export abstract class TestError extends Error {
    constructor(message: string) {
        super(message);
    }

    abstract serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string;


    appendContext(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        const stageName: string = TestStage[stage];
        return `## Error produced in test for: \n
                Network: ${network.name} \n
                Last Stage Completed: ${stageName} \n
                Vault Id: \`\`\`
                ${JSON.stringify(vault_id)}
                \`\`\` \n
                With Error: \n`;
    }
}

export class RpcError extends TestError {

    constructor(message: string, private extrinsic_called: string) {
        super(message);
        this.name = 'RpcError';
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *When Calling Extrinsic*: ${this.extrinsic_called}
        \`\`\``
        return serializedText;
    }
}

export class TimeoutError extends TestError {
    id: string;

    constructor(message: string, id: string, extrinsic_called: string) {
        super(message);
        this.name = 'TimeoutError';
        this.id = id;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Request id*: ${this.id}
        \`\`\``
        return serializedText;
    }
}

export class InconsistentConfigData extends TestError {
    data: object;

    constructor(message: string, data: object) {
        super(message);
        this.name = 'InconsistentConfigData';
        this.data = data;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Data*: ${JSON.stringify(this.data)}
        \`\`\``
        return serializedText;
    }
}

export class InconsistentAmountError extends TestError {
    event: string;
    data: object;
    constructor(message: string, event: string, data: object) {
        super(message);
        this.name = 'InconsistentAmountError';
        this.event = event;
        this.data = data;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Event*: ${this.event}
        *Message*: ${this.message}
        *Data*: ${JSON.stringify(this.data)}
        \`\`\``
        return serializedText;
    }
}

export class ExtrinsicFailedError extends TestError {
    event_name: string;

    constructor(message: string, event_name: string) {
        super(message);
        this.name = 'ExtrinsicFailed';
        this.event_name = event_name;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *event_name*: ${this.event_name}
        \`\`\``
        return serializedText;
    }
}

export class MissingInBlockEventError extends TestError {
    event_name: string;

    constructor(message: string, event_name: string) {
        super(message);
        this.name = 'MissingInBlockEvent';
        this.event_name = event_name;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *event_name*: ${this.event_name}
        \`\`\``
        return serializedText;
    }
}

export class TestDispatchError extends TestError {
    section: string;
    method: string;
    extrinsic_called: string;

    constructor(message: string, method: string, section: string, extrinsic_called: string) {
        super(message);
        this.name = "DispatchError"
        this.section = section;
        this.method = method;
        this.extrinsic_called = extrinsic_called;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText +=
            `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Dispatch Error*: ${this.extrinsic_called}
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
        this.name = 'StellarTransactionError';
        this.type = type;
        this.extras = extras;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Transaction Type*: ${this.type}
        *Info*: ${this.extras}
        \`\`\``
        return serializedText;
    }
}

export class StellarAccountError extends TestError {
    account: string
    constructor(message: string, account: string) {
        super(message);
        this.name = 'StellarAccountError';
        this.account = account;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    serializeForSlack(vault_id: VaultID, network: NetworkConfig, stage: TestStage): string {
        let serializedText = this.appendContext(vault_id, network, stage);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Attempted Account Id*: ${this.account}
        \`\`\``
        return serializedText;
    }
}
