import { VaultID, Wrapped, Wrapped12 } from "./types.js";
//interface for issue event
export interface IIssueRequest {
  issueId: string;
  requester: string;
  amount: number;
  asset: Wrapped | Wrapped12;
  fee: number;
  griefingCollateral: number;
  vaultId: VaultID;
  vaultStellarPublicKey: string;
}

export interface IIssueExecution {
  issueId: string;
  requester: string;
  vaultId: VaultID;
  amount: number;
  asset: Wrapped | Wrapped12;
  fee: number;
}

export interface IRedeemRequest {
  redeemId: string;
  redeemer: string;
  vaultId: VaultID;
  amount: number;
  asset: Wrapped | Wrapped12;
  fee: number;
  premium: number;
  stellarAddress: string;
  transferFee: number;
}

export interface IRedeemExecution {
  redeemId: string;
  redeemer: string;
  vaultId: VaultID;
  amount: number;
  asset: Wrapped | Wrapped12;
  fee: number;
  transferFee: number;
}
