export interface AssetInfo {
    code: string;
    issuer: string;
}

export interface Collateral {
    XCM: number;
}

export interface Wrapped {
    Stellar: {
        AlphaNum4: AssetInfo;
    };
}

export interface Currencies {
    collateral: Collateral;
    wrapped: Wrapped;
}

export interface VaultID {
    accountId: string;
    currencies: Currencies;
}

export function serializeVaultId(vault_id: VaultID): string {
    return JSON.stringify(vault_id);
}

export function deserializeVaultId(vault_id_serialized: string): VaultID {
    return JSON.parse(vault_id_serialized);
}