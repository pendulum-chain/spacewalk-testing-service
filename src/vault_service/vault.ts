import { ApiPromise, Keyring } from '@polkadot/api';
import { VaultID, Wrapped } from "./types.js";
import { IIssueRequest, IRedeemRequest } from './event_types.js';
import { DispatchError, EventRecord } from '@polkadot/types/interfaces';
import { parseEventIssueRequest, parseEventRedeemRequest } from "./event_parsers.js";
import { API } from './api.js';
import { MissingInBlockEventError, TestDispatchError, RpcError } from '../test/test_errors.js';

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
        return new Promise<IIssueRequest>(async (resolve, reject) => {
            const keyring = new Keyring({ type: 'sr25519' });
            const origin = keyring.addFromUri(uri);

            const release = await this.api.mutex.lock(origin.address);

            const nonce = await this.api.api.rpc.system.accountNextIndex(origin.publicKey);
            await this.api.api.tx.issue.requestIssue(amount, this.vault_id).signAndSend(origin, { nonce }, ({ status, events, dispatchError }) => {

                if (status.isFinalized) {

                    if (dispatchError) {
                        reject(this.handleDispatchError(dispatchError, "Issue Request"));
                    }
                    else {
                        //find all issue events and filter the one that matches the requester
                        let issueEvents = events.filter((event: EventRecord) => {
                            return event.event.section === 'issue' && event.event.method === 'RequestIssue';
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
                }
            }).catch((error) => {
                reject(new RpcError(error.message, "Issue Request"));
            }).finally(() => release());
        });
    }

    public async request_redeem(uri: string, amount: number, stellar_pk_bytes: Buffer): Promise<IRedeemRequest> {
        return new Promise<IRedeemRequest>(async (resolve, reject) => {
            const keyring = new Keyring({ type: 'sr25519' });
            const origin = keyring.addFromUri(uri);

            const release = await this.api.mutex.lock(origin.address);
            const nonce = await this.api.api.rpc.system.accountNextIndex(origin.publicKey);
            await this.api.api.tx.redeem.requestRedeem(amount, stellar_pk_bytes, this.vault_id).signAndSend(origin, { nonce }, ({ status, events, dispatchError }) => {
                if (status.isFinalized) {
                    if (dispatchError) {

                        reject(this.handleDispatchError(dispatchError, "Redeem Request"));
                    }
                    else {
                        //find all redeem request events and filter the one that matches the requester
                        let redeemEvents = events.filter((event: EventRecord) => {
                            return event.event.section === 'redeem' && event.event.method === 'RequestRedeem';
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
                }
            }).catch((error) => {
                reject(new RpcError(error.message, "Redeem Request"));
            }).finally(() => release());
        });
    }

    handleDispatchError(dispatchError: any, extrinsic_called: string): TestDispatchError {
        if (dispatchError.isModule) {
            const decoded = this.api.api.registry.findMetaError(dispatchError.asModule);
            const { docs, name, section, method } = decoded;

            return new TestDispatchError("Dispatch Error", method, section, extrinsic_called)
        } else {
            return new TestDispatchError("Dispatch Error", "", "", "?")
        }
    }


}

