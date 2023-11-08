import { DispatchError, EventRecord } from "@polkadot/types/interfaces";
import {
  IIssueExecution,
  IIssueRequest,
  IRedeemExecution,
  IRedeemRequest,
} from "./event_types.js";
import { stellarHexToPublic, hexToString } from "../stellar_service/convert.js";
import { Wrapped, Wrapped12, AssetInfo } from "./types.js";

export function parseEventIssueExecution(event: EventRecord): IIssueExecution {
  const rawEventData = JSON.parse(event.event.data.toString());
  const mappedData: IIssueExecution = {
    issueId: rawEventData[0].toString(),
    requester: rawEventData[1].toString(),
    vaultId: {
      accountId: rawEventData[2].accountId.toString(),
      currencies: {
        collateral: {
          XCM: parseInt(
            rawEventData[2].currencies.collateral.xcm.toString(),
            10,
          ),
        },
        wrapped: extractStellarAsset(rawEventData[2].currencies.wrapped),
      },
    },
    amount: parseInt(rawEventData[3].toString(), 10),
    asset: extractStellarAsset(rawEventData[4]),
    fee: parseInt(rawEventData[5].toString(), 10),
  };
  return mappedData;
}

export function parseEventIssueRequest(event: EventRecord): IIssueRequest {
  const rawEventData = JSON.parse(event.event.data.toString());

  const mappedData: IIssueRequest = {
    issueId: rawEventData[0].toString(),
    requester: rawEventData[1].toString(),
    amount: parseInt(rawEventData[2].toString(), 10),
    asset: extractStellarAsset(rawEventData[3]),
    fee: parseInt(rawEventData[4].toString(), 10),
    griefingCollateral: parseInt(rawEventData[5].toString(), 10),
    vaultId: {
      accountId: rawEventData[6].accountId.toString(),
      currencies: {
        collateral: {
          XCM: parseInt(
            rawEventData[6].currencies.collateral.xcm.toString(),
            10,
          ),
        },
        wrapped: extractStellarAsset(rawEventData[6].currencies.wrapped),
      },
    },
    vaultStellarPublicKey: stellarHexToPublic(rawEventData[7].toString()),
  };
  return mappedData;
}

export function parseEventRedeemRequest(event: EventRecord): IRedeemRequest {
  const rawEventData = JSON.parse(event.event.data.toString());
  const mappedData: IRedeemRequest = {
    redeemId: rawEventData[0].toString(),
    redeemer: rawEventData[1].toString(),
    vaultId: {
      accountId: rawEventData[2].accountId.toString(),
      currencies: {
        collateral: {
          XCM: parseInt(
            rawEventData[2].currencies.collateral.xcm.toString(),
            10,
          ),
        },
        wrapped: extractStellarAsset(rawEventData[2].currencies.wrapped),
      },
    },
    amount: parseInt(rawEventData[3].toString(), 10),
    asset: extractStellarAsset(rawEventData[4]),
    fee: parseInt(rawEventData[5].toString(), 10),
    premium: parseInt(rawEventData[6].toString(), 10),
    stellarAddress: stellarHexToPublic(rawEventData[7].toString()),
    transferFee: parseInt(rawEventData[8].toString(), 10),
  };
  return mappedData;
}

export function parseEventRedeemExecution(
  event: EventRecord,
): IRedeemExecution {
  const rawEventData = JSON.parse(event.event.data.toString());
  const mappedData: IRedeemExecution = {
    redeemId: rawEventData[0].toString(),
    redeemer: rawEventData[1].toString(),
    vaultId: {
      accountId: rawEventData[2].accountId.toString(),
      currencies: {
        collateral: {
          XCM: parseInt(
            rawEventData[2].currencies.collateral.xcm.toString(),
            10,
          ),
        },
        wrapped: extractStellarAsset(rawEventData[2].currencies.wrapped),
      },
    },
    amount: parseInt(rawEventData[3].toString(), 10),
    asset: extractStellarAsset(rawEventData[4]),
    fee: parseInt(rawEventData[5].toString(), 10),
    transferFee: parseInt(rawEventData[6].toString(), 10),
  };
  return mappedData;
}

function extractStellarAsset(data: any): Wrapped | Wrapped12 {
  if ("alphaNum4" in data.stellar) {
    return {
      Stellar: {
        AlphaNum4: {
          code: hexToString(data.stellar.alphaNum4.code.toString()),
          issuer: stellarHexToPublic(data.stellar.alphaNum4.issuer.toString()),
        },
      },
    };
  } else if ("alphaNum12" in data.stellar) {
    return {
      Stellar: {
        AlphaNum12: {
          code: hexToString(data.stellar.alphaNum12.code.toString()),
          issuer: stellarHexToPublic(data.stellar.alphaNum12.issuer.toString()),
        },
      },
    };
  } else {
    throw new Error("Invalid Stellar type");
  }
}
