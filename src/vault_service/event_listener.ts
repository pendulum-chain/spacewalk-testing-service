import { ApiPromise } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces';
import { parseEventIssueExecution, parseEventRedeemExecution } from './event_parsers.js';
import { IIssueExecution, IRedeemExecution } from './event_types.js';
import { TimeoutError } from '../test/test_errors.js';
type EventFilter<T> = (event: any) => T | null;

type PendingEvent<T> = {
    filter: EventFilter<T>;
    resolve: (value: T) => void;
};



export class EventListener {
    private static eventListeners: Map<ApiPromise, EventListener> = new Map();

    private pendingIssueEvents: Array<PendingEvent<IIssueExecution>> = [];
    private pendingRedeemEvents: Array<PendingEvent<IRedeemExecution>> = [];

    private constructor(private api: ApiPromise) {
        this.initEventSubscriber();
    }

    public static getEventListener(api: ApiPromise): EventListener {
        if (!this.eventListeners.has(api)) {
            const newListener = new EventListener(api);
            this.eventListeners.set(api, newListener);
        }
        return this.eventListeners.get(api)!;
    }

    private async initEventSubscriber() {

        this.api.query.system.events((events: EventRecord[]) => {
            events.forEach((event: EventRecord) => {
                // if (this.pendingEvents.length === 0) {
                //     return;
                // };

                this.processEvents<IIssueExecution>(event, this.pendingIssueEvents);
                this.processEvents<IRedeemExecution>(event, this.pendingRedeemEvents);


            });
        });
    }

    // We wrap two promises, with the inner creating by setTimeout rejecting if the max waiting time is achieved,
    // and the outer resolving and also clearing the timeout. 
    public waitForIssueExecuteEvent(issue_id: string, max_waiting_time_ms: number): Promise<IIssueExecution> {
        let filter = (event: EventRecord) => {
            if (event.event.section === 'issue' && event.event.method === "ExecuteIssue") {
                let event_parsed = parseEventIssueExecution(event);
                if (event_parsed.issue_id == issue_id) {
                    return event_parsed;
                }
            };
            return null;
        }

        return new Promise<IIssueExecution>((resolve, reject) => {

            const timeout = setTimeout(() => {
                reject(new TimeoutError('Max waiting time exceeded for Issue Execution', issue_id, "Issue Execution"))
            }, max_waiting_time_ms);

            this.pendingIssueEvents.push({
                filter, resolve: (event) => {
                    clearTimeout(timeout);
                    resolve(event)
                }
            });
        });
    }

    public waitForRedeemExecuteEvent(redeem_id: string, max_waiting_time_ms: number): Promise<IRedeemExecution> {
        let filter = (event: EventRecord) => {
            if (event.event.section === 'redeem' && event.event.method === "ExecuteRedeem") {
                let event_parsed = parseEventRedeemExecution(event);
                if (event_parsed.redeem_id == redeem_id) {
                    return event_parsed;
                }
            };
            return null;
        }

        return new Promise<IRedeemExecution>((resolve, reject) => {

            const timeout = setTimeout(() => {
                reject(new TimeoutError('Max waiting time exceeded for Redeem Execution', redeem_id, "Redeem Execution"))
            }, max_waiting_time_ms);

            this.pendingRedeemEvents.push({
                filter, resolve: (event) => {
                    clearTimeout(timeout);
                    resolve(event)
                }
            });
        });
    }


    private processEvents<T>(event: any, pendingEvents: Array<PendingEvent<T>>) {
        pendingEvents.forEach((pendingEvent, index) => {
            const matchedEvent = pendingEvent.filter(event);
            if (matchedEvent) {
                pendingEvent.resolve(matchedEvent);
                pendingEvents.splice(index, 1);
            }
        });
    }

}