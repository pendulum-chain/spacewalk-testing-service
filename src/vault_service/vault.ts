import {ApiPromise, Keyring} from '@polkadot/api';
import {VaultID, Wrapped} from "./types.js";
import {IIssueRequest, IRedeemRequest} from './event_types.js';
import {DispatchError, EventRecord} from '@polkadot/types/interfaces';
import {parseEventIssueRequest, parseEventRedeemRequest} from "./event_parsers.js";
import {API} from './api.js';
import {MissingInBlockEventError, TestDispatchError, RpcError, ExtrinsicFailedError} from '../test/test_errors.js';


export class VaultService {
    public vault_id: VaultID;
    private api: API;

    constructor(vault_id: VaultID, api: API) {

        this.vault_id = vault_id;
        // Potentially validate the vault given the network,
        // validate the wrapped asset consistency, etc
        this.api = api;
    }

    public async request_issue(uri: string, amount: number): Promise<IIssueRequest> {
        console.log("Requesting issue of", amount, "for vault", this.vault_id)

        return new Promise<IIssueRequest>(async (resolve, reject) => {
            const keyring = new Keyring({type: 'sr25519'});
            keyring.setSS58Format(this.api.ss58Format);
            const origin = keyring.addFromUri(uri);

            const release = await this.api.mutex.lock(origin.address);

            const nonce = await this.api.api.rpc.system.accountNextIndex(origin.publicKey);
            await this.api.api.tx.issue.requestIssue(amount, this.vault_id).signAndSend(origin, {nonce}, (submissionResult) => {
                const {
                    status,
                    events,
                    dispatchError,
                } = submissionResult;

                if (status.isFinalized) {
                    console.log("Requested issue of", amount, "for vault", this.vault_id, "with status", status.type)
                    console.log(`Transaction included at blockHash ${status.asFinalized}`);

                    if (dispatchError)
                        return reject(this.handleDispatchError(dispatchError, "Issue Request"));

                    // Try to find a 'system.ExtrinsicFailed' event
                    const systemExtrinsicFailedEvent = events.find((record) => {
                        return record.event.section === 'system' && record.event.method === 'ExtrinsicFailed';
                    });

                    if (systemExtrinsicFailedEvent)
                        return reject(new ExtrinsicFailedError('Extrinsic failed', systemExtrinsicFailedEvent?.event.data[0].toString() ?? 'Unknown'));

                    //find all issue events and filter the one that matches the requester
                    let issueEvents = events.filter((event: EventRecord) => {
                        return event.event.section.toLowerCase() === 'issue' && event.event.method.toLowerCase() === 'requestissue';
                    });

                    let event = issueEvents.map((event) => parseEventIssueRequest(event)).filter((event: IIssueRequest) => {
                        return event.requester === origin.address;
                    });

                    if (event.length == 0) {
                        reject(new MissingInBlockEventError('No issue event found', 'Issue Request Event'));
                    }

                    //we should only find one event corresponding to the issue request
                    if (event.length != 1) {
                        reject(new Error('Inconsistent amount of issue events for account'));
                    }
                    resolve(event[0]);

                }
            }).catch((error) => {
                reject(new RpcError(error.message, "Issue Request"));
            }).finally(() => release());
        });
    }

    public async request_redeem(uri: string, amount: number, stellar_pk_bytes: Buffer): Promise<IRedeemRequest> {
        return new Promise<IRedeemRequest>(async (resolve, reject) => {
            const keyring = new Keyring({type: 'sr25519'});
            keyring.setSS58Format(this.api.ss58Format);
            const origin = keyring.addFromUri(uri);

            const release = await this.api.mutex.lock(origin.address);
            const nonce = await this.api.api.rpc.system.accountNextIndex(origin.publicKey);
            await this.api.api.tx.redeem.requestRedeem(amount, stellar_pk_bytes, this.vault_id).signAndSend(origin, {nonce}, (submissionResult) => {
                const {
                    status,
                    events,
                    dispatchError,
                } = submissionResult;

                if (status.isFinalized) {
                    console.log("Requested issue of", amount, "for vault", this.vault_id, "with status", status.type)
                    console.log(`Transaction included at blockHash ${status.asFinalized}`);

                    if (dispatchError)
                        reject(this.handleDispatchError(dispatchError, "Redeem Request"));

                    // Try to find a 'system.ExtrinsicFailed' event
                    const systemExtrinsicFailedEvent = events.find((record) => {
                        return record.event.section === 'system' && record.event.method === 'ExtrinsicFailed';
                    });

                    if (systemExtrinsicFailedEvent)
                        return reject(new ExtrinsicFailedError('Extrinsic failed', systemExtrinsicFailedEvent?.event.data[0].toString() ?? 'Unknown'));

                    //find all redeem request events and filter the one that matches the requester
                    let redeemEvents = events.filter((event: EventRecord) => {
                        return event.event.section.toLowerCase() === 'redeem' && event.event.method.toLowerCase() === 'requestredeem';
                    });

                    let event = redeemEvents.map((event) => parseEventRedeemRequest(event)).filter((event: IRedeemRequest) => {
                        return event.redeemer === origin.address;
                    });

                    if (event.length == 0) {
                        reject(new MissingInBlockEventError('No redeem event found', 'Redeem Request Event'));
                    }
                    //we should only find one event corresponding to the issue request
                    if (event.length != 1) {
                        reject(new Error('Inconsistent amount of redeem request events for account'));
                    }
                    resolve(event[0]);

                }
            }).catch((error) => {
                reject(new RpcError(error.message, "Redeem Request"));
            }).finally(() => release());
        });
    }

    handleDispatchError(dispatchError: any, extrinsic_called: string): TestDispatchError {
        if (dispatchError.isModule) {
            const decoded = this.api.api.registry.findMetaError(dispatchError.asModule);
            const {docs, name, section, method} = decoded;

            return new TestDispatchError("Dispatch Error", method, section, extrinsic_called)
        } else {
            return new TestDispatchError("Dispatch Error", "", "", "?")
        }
    }
}

