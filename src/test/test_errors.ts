import { NetworkConfig } from "../config.js";
import { VaultID } from "../vault_service/types.js";

export abstract class TestError extends Error {
    constructor(message: string) {
        super(message);
    }

    abstract serializeForSlack(vault_id: VaultID, network: NetworkConfig): string;


    appendContext(vault_id: VaultID, network: NetworkConfig): string {
        return `## Error produced in test for: \n
                Network: \`\`\`
                ${JSON.stringify(network.name)}
                \`\`\` \n
                Vault Id: \`\`\`
                ${JSON.stringify(vault_id)}
                \`\`\` \n
                With Error: \n`;
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

    serializeForSlack(vault_id: VaultID, network: NetworkConfig): string {
        let serializedText = this.appendContext(vault_id, network);
        serializedText += `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *Request id*: ${this.id}
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

    serializeForSlack(vault_id: VaultID, network: NetworkConfig): string {
        return `\`\`\`
        *Error Name*: ${this.name}
        *Message*: ${this.message}
        *event_name*: ${this.event_name}
        \`\`\``;
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

    serializeForSlack(vault_id: VaultID, network: NetworkConfig): string {
        let serializedText = this.appendContext(vault_id, network);
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