
import { VaultID, Wrapped, Wrapped12 } from "./types.js";
//interface for issue event
export interface IIssueRequest {
    issue_id: string;
    requester: string,
    amount: number,
    asset: Wrapped | Wrapped12,
    fee: number,
    griefing_collateral: number,
    vault_id: VaultID,
    vault_stellar_public_key: string
};

export interface IIssueExecution {
    issue_id: string;
    requester: string;
    vault_id: VaultID;
    amount: number;
    asset: Wrapped | Wrapped12,
    fee: number,
}

export interface IRedeemRequest {
    redeem_id: string;
    redeemer: string;
    vault_id: VaultID;
    amount: number;
    asset: Wrapped | Wrapped12,
    fee: number,
    premium: number,
    stellar_address: string,
    transfer_fee: number,
}


export interface IRedeemExecution {
    redeem_id: string;
    redeemer: string;
    vault_id: VaultID;
    amount: number;
    asset: Wrapped | Wrapped12,
    fee: number,
    transfer_fee: number,
}
