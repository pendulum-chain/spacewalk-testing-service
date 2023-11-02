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

export interface Wrapped12 {
    Stellar: {
        AlphaNum12: AssetInfo;
    };
}

export interface Currencies {
    collateral: Collateral;
    wrapped: Wrapped | Wrapped12;
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

export function extractAssetCodeIssuerFromWrapped(wrapped: Wrapped | Wrapped12): AssetInfo {
    if ('AlphaNum4' in wrapped.Stellar) {
        return {
            code: wrapped.Stellar.AlphaNum4.code,
            issuer: wrapped.Stellar.AlphaNum4.issuer
        };
    } else if ('AlphaNum12' in wrapped.Stellar) {
        return {
            code: wrapped.Stellar.AlphaNum12.code,
            issuer: wrapped.Stellar.AlphaNum12.issuer
        };
    } else {
        throw new Error('Invalid Stellar type in wrapped');
    }
}