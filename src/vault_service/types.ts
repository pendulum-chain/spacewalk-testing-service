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

export function serializeVaultId(
  vaultId: VaultID,
  networkName: string
): string {
  return JSON.stringify({ vaultId: vaultId, networkName });
}

export function deserializeVaultId(vaultIdSerialized: string): VaultID {
  return JSON.parse(vaultIdSerialized);
}

export function extractAssetCodeIssuerFromWrapped(
  wrapped: Wrapped | Wrapped12
): AssetInfo {
  if ("AlphaNum4" in wrapped.Stellar) {
    return {
      code: wrapped.Stellar.AlphaNum4.code,
      issuer: wrapped.Stellar.AlphaNum4.issuer,
    };
  } else if ("AlphaNum12" in wrapped.Stellar) {
    return {
      code: wrapped.Stellar.AlphaNum12.code,
      issuer: wrapped.Stellar.AlphaNum12.issuer,
    };
  } else {
    throw new Error("Invalid Stellar type in wrapped");
  }
}
