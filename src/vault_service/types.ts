import { Asset } from "stellar-sdk";
import { stellarHexToPublic } from "../stellar_service/convert.js";

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

export function deserializeVaultId(vaultIdSerialized: string): {
  vaultId: VaultID;
  networkName: string;
} {
  return JSON.parse(vaultIdSerialized);
}

export function prettyPrintVaultId(vaultId: VaultID): string {
  const wrappedAssetInfo = extractAssetFromWrapped(vaultId.currencies.wrapped);

  return `${vaultId.accountId} { XCM(${
    vaultId.currencies.collateral.XCM
  }) - ${prettyPrintAssetInfo(wrappedAssetInfo)} }`;
}

// We just omit the issuer here for readability
function prettyPrintAssetInfo(assetInfo: Asset): string {
  // Decode hex code to ascii if it starts with 0x
  if (assetInfo.code.startsWith("0x")) {
    return trimCode(assetInfo.code);
  }

  return assetInfo.code;
}

// Take an asset code that is either hex or ascii and trim it from 0 bytes
function trimCode(code: string): string {
  if (code.startsWith("0x")) {
    // Filter out the null bytes
    const filtered = code.replace(/00/g, "");
    return Buffer.from(filtered.slice(2), "hex").toString().trim();
  } else {
    // Convert to hex string
    const hex = Buffer.from(code).toString("hex");
    // Filter out the null bytes
    const filtered = hex.replace(/00/g, "");
    // Convert back to ascii
    return Buffer.from(filtered, "hex").toString().trim();
  }
}

export function extractAssetFromWrapped(
  wrapped: StellarNative | Wrapped4 | Wrapped12,
): Asset {
  if (wrapped.Stellar === "StellarNative") {
    return Asset.native();
  } else if ("AlphaNum4" in wrapped.Stellar) {
    // Check if we need to convert the issuer to a public key
    const issuer = wrapped.Stellar.AlphaNum4.issuer.startsWith("0x")
      ? stellarHexToPublic(wrapped.Stellar.AlphaNum4.issuer)
      : wrapped.Stellar.AlphaNum4.issuer;
    const code = trimCode(wrapped.Stellar.AlphaNum4.code);

    return new Asset(trimCode(wrapped.Stellar.AlphaNum4.code), issuer);
  } else if ("AlphaNum12" in wrapped.Stellar) {
    // Check if we need to convert the issuer to a public key
    const issuer = wrapped.Stellar.AlphaNum12.issuer.startsWith("0x")
      ? stellarHexToPublic(wrapped.Stellar.AlphaNum12.issuer)
      : wrapped.Stellar.AlphaNum12.issuer;

    return new Asset(trimCode(wrapped.Stellar.AlphaNum12.code), issuer);
  } else {
    throw new Error("Invalid Stellar type in wrapped");
  }
}
