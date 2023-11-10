import { ApiPromise } from "@polkadot/api";
import { EventRecord } from "@polkadot/types/interfaces";
import {
  parseEventIssueExecution,
  parseEventRedeemExecution,
} from "./event_parsers.js";
import { IIssueExecution, IRedeemExecution } from "./event_types.js";
import { TimeoutError } from "../test/errors.js";
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
  public waitForIssueExecuteEvent(
    issueId: string,
    maxWaitingTimeMs: number,
  ): Promise<IIssueExecution> {
    let filter = (event: EventRecord) => {
      if (
        event.event.section === "issue" &&
        event.event.method === "ExecuteIssue"
      ) {
        let eventParsed = parseEventIssueExecution(event);
        if (eventParsed.issueId == issueId) {
          return eventParsed;
        }
      }
      return null;
    };

    return new Promise<IIssueExecution>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new TimeoutError(
            "Max waiting time exceeded for Issue Execution",
            issueId,
            "Issue Execution",
          ),
        );
      }, maxWaitingTimeMs);

      this.pendingIssueEvents.push({
        filter,
        resolve: (event) => {
          clearTimeout(timeout);
          resolve(event);
        },
      });
    });
  }

  public waitForRedeemExecuteEvent(
    redeemId: string,
    maxWaitingTimeMs: number,
  ): Promise<IRedeemExecution> {
    let filter = (event: EventRecord) => {
      if (
        event.event.section === "redeem" &&
        event.event.method === "ExecuteRedeem"
      ) {
        let eventParsed = parseEventRedeemExecution(event);
        if (eventParsed.redeemId == redeemId) {
          return eventParsed;
        }
      }
      return null;
    };

    return new Promise<IRedeemExecution>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new TimeoutError(
            "Max waiting time exceeded for Redeem Execution",
            redeemId,
            "Redeem Execution",
          ),
        );
      }, maxWaitingTimeMs);

      this.pendingRedeemEvents.push({
        filter,
        resolve: (event) => {
          clearTimeout(timeout);
          resolve(event);
        },
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
