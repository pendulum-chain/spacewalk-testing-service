import { ApiPromise, Keyring } from "@polkadot/api";
import { prettyPrintVaultId, VaultID, Wrapped4 } from "./types.js";
import { IIssueRequest, IRedeemRequest } from "./event_types.js";
import { DispatchError, EventRecord } from "@polkadot/types/interfaces";
import {
  parseEventIssueRequest,
  parseEventRedeemRequest,
} from "./event_parsers.js";
import { API } from "./api.js";
import {
  MissingInBlockEventError,
  TestDispatchError,
  RpcError,
  ExtrinsicFailedError,
} from "../test/errors.js";

export class VaultService {
  public vaultId: VaultID;
  private api: API;

  constructor(vaultId: VaultID, api: API) {
    this.vaultId = vaultId;
    // Potentially validate the vault given the network,
    // validate the wrapped asset consistency, etc
    this.api = api;
  }

  public async requestIssue(
    uri: string,
    amount: number,
  ): Promise<IIssueRequest> {
    console.log(
      `Requesting issue of ${amount} for vault ${prettyPrintVaultId(
        this.vaultId,
      )}`,
    );

    return new Promise<IIssueRequest>(async (resolve, reject) => {
      const keyring = new Keyring({ type: "sr25519" });
      keyring.setSS58Format(this.api.ss58Format);
      const origin = keyring.addFromUri(uri);

      const release = await this.api.mutex.lock(origin.address);

      const nonce = await this.api.api.rpc.system.accountNextIndex(
        origin.publicKey,
      );
      await this.api.api.tx.issue
        .requestIssue(amount, this.vaultId)
        .signAndSend(origin, { nonce }, (submissionResult) => {
          const { status, events, dispatchError, internalError } =
            submissionResult;

          if (status.isFinalized) {
            console.log(
              `Requested issue of ${amount} for vault ${prettyPrintVaultId(
                this.vaultId,
              )} with status ${status.type}`,
            );

            // Try to find a 'system.ExtrinsicFailed' event
            const systemExtrinsicFailedEvent = events.find((record) => {
              return (
                record.event.section === "system" &&
                record.event.method === "ExtrinsicFailed"
              );
            });

            if (dispatchError) {
              return reject(
                this.handleDispatchError(
                  dispatchError,
                  systemExtrinsicFailedEvent,
                  "Issue Request",
                ),
              );
            }

            //find all issue events and filter the one that matches the requester
            let issueEvents = events.filter((event: EventRecord) => {
              return (
                event.event.section.toLowerCase() === "issue" &&
                event.event.method.toLowerCase() === "requestissue"
              );
            });

            let event = issueEvents
              .map((event) => parseEventIssueRequest(event))
              .filter((event: IIssueRequest) => {
                return event.requester === origin.address;
              });

            if (event.length == 0) {
              reject(
                new MissingInBlockEventError(
                  "No issue event found",
                  "Issue Request Event",
                ),
              );
            }

            //we should only find one event corresponding to the issue request
            if (event.length != 1) {
              reject(
                new Error("Inconsistent amount of issue events for account"),
              );
            }
            resolve(event[0]);
          }
        })
        .catch((error) => {
          reject(new RpcError(error.message, "Issue Request", origin.address));
        })
        .finally(() => release());
    });
  }

  public async requestRedeem(
    uri: string,
    amount: number,
    stellarPkBytes: Buffer,
  ): Promise<IRedeemRequest> {
    return new Promise<IRedeemRequest>(async (resolve, reject) => {
      const keyring = new Keyring({ type: "sr25519" });
      keyring.setSS58Format(this.api.ss58Format);
      const origin = keyring.addFromUri(uri);

      const release = await this.api.mutex.lock(origin.address);
      const nonce = await this.api.api.rpc.system.accountNextIndex(
        origin.publicKey,
      );
      await this.api.api.tx.redeem
        .requestRedeem(amount, stellarPkBytes, this.vaultId)
        .signAndSend(origin, { nonce }, (submissionResult) => {
          const { status, events, dispatchError } = submissionResult;

          if (status.isFinalized) {
            console.log(
              `Requested redeem of ${amount} for vault ${prettyPrintVaultId(
                this.vaultId,
              )} with status ${status.type}`,
            );

            // Try to find a 'system.ExtrinsicFailed' event
            const systemExtrinsicFailedEvent = events.find((record) => {
              return (
                record.event.section === "system" &&
                record.event.method === "ExtrinsicFailed"
              );
            });

            if (dispatchError) {
              return reject(
                this.handleDispatchError(
                  dispatchError,
                  systemExtrinsicFailedEvent,
                  "Redeem Request",
                ),
              );
            }
            //find all redeem request events and filter the one that matches the requester
            let redeemEvents = events.filter((event: EventRecord) => {
              return (
                event.event.section.toLowerCase() === "redeem" &&
                event.event.method.toLowerCase() === "requestredeem"
              );
            });

            let event = redeemEvents
              .map((event) => parseEventRedeemRequest(event))
              .filter((event: IRedeemRequest) => {
                return event.redeemer === origin.address;
              });

            if (event.length == 0) {
              reject(
                new MissingInBlockEventError(
                  "No redeem event found",
                  "Redeem Request Event",
                ),
              );
            }
            //we should only find one event corresponding to the issue request
            if (event.length != 1) {
              reject(
                new Error(
                  "Inconsistent amount of redeem request events for account",
                ),
              );
            }
            resolve(event[0]);
          }
        })
        .catch((error) => {
          reject(new RpcError(error.message, "Redeem Request", origin.address));
        })
        .finally(() => release());
    });
  }

  // We first check if dispatchError is of type "module",
  // If not we either return ExtrinsicFailedError or Unknown dispatch error
  handleDispatchError(
    dispatchError: any,
    systemExtrinsicFailedEvent: EventRecord | undefined,
    extrinsicCalled: string,
  ): TestDispatchError | ExtrinsicFailedError {
    if (dispatchError?.isModule) {
      const decoded = this.api.api.registry.findMetaError(
        dispatchError.asModule,
      );
      const { docs, name, section, method } = decoded;

      return new TestDispatchError(
        "Dispatch Error",
        method,
        section,
        extrinsicCalled,
      );
    } else if (systemExtrinsicFailedEvent) {
      const eventName =
        systemExtrinsicFailedEvent?.event.data &&
        systemExtrinsicFailedEvent?.event.data.length > 0
          ? systemExtrinsicFailedEvent?.event.data[0].toString()
          : "Unknown";

      const {
        phase,
        event: { data, method, section },
      } = systemExtrinsicFailedEvent;
      console.log(`Extrinsic failed: ${phase}: ${section}.${method}:: ${data}`);

      return new ExtrinsicFailedError("Extrinsic failed", eventName);
    } else {
      console.log(
        "Encountered some other error: ",
        dispatchError?.toString(),
        JSON.stringify(dispatchError),
      );
      return new TestDispatchError(
        "Unknown Dispatch Error",
        "Unknown",
        "Unknown",
        extrinsicCalled,
      );
    }
  }
}
