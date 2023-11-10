export interface AssetInfo {
  code: string;
  issuer: string;
}

export interface Collateral {
  XCM: number;
}

export interface StellarNative {
  Stellar: "StellarNative";
}

export interface Wrapped4 {
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
  wrapped: StellarNative | Wrapped4 | Wrapped12;
}

export interface VaultID {
  accountId: string;
  currencies: Currencies;
}

export function serializeVaultId(
  vaultId: VaultID,
  networkName: string,
): string {
  return JSON.stringify({ vaultId: vaultId, networkName });
}

export function deserializeVaultId(vaultIdSerialized: string): VaultID {
  return JSON.parse(vaultIdSerialized);
}

export function prettyPrintVaultId(vaultId: VaultID): string {
  const wrappedAssetInfo = extractAssetCodeIssuerFromWrapped(
    vaultId.currencies.wrapped,
  );

  return `${vaultId.accountId} { XCM(${
    vaultId.currencies.collateral.XCM
  }) - ${prettyPrintAssetInfo(wrappedAssetInfo)} }`;
}

// We just omit the issuer here
function prettyPrintAssetInfo(assetInfo: AssetInfo): string {
  // Decode hex code to ascii if it starts with 0x
  if (assetInfo.code.startsWith("0x")) {
    return Buffer.from(assetInfo.code.slice(2), "hex").toString();
  }

  return `${assetInfo.code}`;
}

export function extractAssetCodeIssuerFromWrapped(
  wrapped: StellarNative | Wrapped4 | Wrapped12,
): AssetInfo {
  // TODO transform to real Stellar asset and convert hex to ascii
  if (wrapped.Stellar === "StellarNative") {
    return { code: "XLM", issuer: "" };
  } else if ("AlphaNum4" in wrapped.Stellar) {
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
