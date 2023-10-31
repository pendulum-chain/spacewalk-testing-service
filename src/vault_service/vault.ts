import { ApiPromise, Keyring } from '@polkadot/api';
import { VaultID, Wrapped } from "../config.js";
import { IIssueRequest, IRedeemRequest } from './event_types.js';
import { DispatchError, EventRecord } from '@polkadot/types/interfaces';
import { parseEventIssueRequest, parseEventRedeemRequest } from "./event_parsers.js";


export class VaultService {
    public vault_id: VaultID;
    private api: ApiPromise;

    constructor(vault_id: VaultID, api: ApiPromise) {

        this.vault_id = vault_id;
        // Potentially validate the vault given the network,
        // validate the wrapped asset consistency, etc
        this.api = api;
    }

    public async request_issue(uri: string, amount: number): Promise<IIssueRequest> {
        return new Promise<IIssueRequest>(async (resolve, reject) => {
            const keyring = new Keyring({ type: 'sr25519' });
            const origin = keyring.addFromUri(uri);

            await this.api.tx.issue.requestIssue(amount, this.vault_id).signAndSend(origin, ({ status, events, dispatchError }) => {
                if (status.isFinalized) {
                    console.log(`Transaction included in block: ${status.asFinalized}`);

                    if (dispatchError) {

                        this.handleDispatchError(dispatchError);
                        reject(new Error('Transaction failed due to dispatch error.'));
                    }
                    else {
                        console.log(`No dispatchError at the finalized stage.`);

                        //find all issue events and filter the one that matches the requester
                        let issueEvents = events.filter((event: EventRecord) => {
                            return event.event.section === 'issue' && event.event.method === 'RequestIssue';
                        });

                        if (issueEvents.length == 0) {
                            reject(new Error('No issue events found'));
                        }
                        let event = issueEvents.map((event) => parseEventIssueRequest(event)).filter((event: IIssueRequest) => {
                            return event.requester === origin.address;
                        });
                        //we should only find one event corresponding to the issue request
                        if (event.length != 1) {
                            reject(new Error('Inconsistent amount of issue events for account'));
                        }
                        resolve(event[0]);

                    }
                }
            });
        });
    }

    public async request_redeem(uri: string, amount: number, stellar_pk_bytes: Buffer): Promise<IRedeemRequest> {
        return new Promise<IRedeemRequest>(async (resolve, reject) => {
            const keyring = new Keyring({ type: 'sr25519' });
            const origin = keyring.addFromUri(uri);

            await this.api.tx.redeem.requestRedeem(amount, stellar_pk_bytes, this.vault_id).signAndSend(origin, ({ status, events, dispatchError }) => {
                if (status.isFinalized) {
                    if (dispatchError) {
                        this.handleDispatchError(dispatchError);
                        reject(new Error('Transaction failed due to dispatch error.'));
                    }
                    else {
                        //find all redeem request events and filter the one that matches the requester
                        let issueEvents = events.filter((event: EventRecord) => {
                            return event.event.section === 'redeem' && event.event.method === 'RequestRedeem';
                        });

                        if (issueEvents.length == 0) {
                            reject(new Error('No redeem request events found'));
                        }
                        let event = issueEvents.map((event) => parseEventRedeemRequest(event)).filter((event: IRedeemRequest) => {
                            return event.redeemer === origin.address;
                        });
                        //we should only find one event corresponding to the issue request
                        if (event.length != 1) {
                            reject(new Error('Inconsistent amount of redeem request events for account'));
                        }
                        resolve(event[0]);

                    }
                }
            });
        });
    }

    async handleDispatchError(dispatchError: any) {
        if (dispatchError.isModule) {
            const decoded = this.api.registry.findMetaError(dispatchError.asModule);
            const { docs, name, section } = decoded;
            console.log(`${section}.${name}: ${docs.join(' ')}`);
        } else {
            console.log(dispatchError.toString());
        }
    }


}

