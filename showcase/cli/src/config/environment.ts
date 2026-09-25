import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { isAddress, isHex, type Address, type Hex } from "viem";
import { getDeploymentByChainId, type Deployment } from "./deployments.js";

/** Complete SDK configuration profiles the terminal can activate. */
export type SdkEnvironment = "production" | "staging";

function readTrimmed(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Deployment selected when the terminal starts. */
export function getInitialDeploymentId(): Deployment["id"] {
  const value = readTrimmed("SYMMIO_CHAIN")?.toLowerCase();
  if (value === "base" || value === String(SymmioSupportedChainId.BASE)) return "base";
  return "arbitrum";
}

/** SDK profile selected when the terminal starts. */
export function getInitialEnvironment(): SdkEnvironment {
  return readTrimmed("SYMMIO_ENVIRONMENT")?.toLowerCase() === "staging" ? "staging" : "production";
}

/** RPC endpoint for one supported chain, with chain-specific env overrides. */
export function getRpcUrl(chainId: number): string {
  const deployment = getDeploymentByChainId(chainId);
  const specific = deployment.id === "arbitrum" ? "SYMMIO_ARBITRUM_RPC_URL" : "SYMMIO_BASE_RPC_URL";
  return readTrimmed(specific) ?? readTrimmed("SYMMIO_RPC_URL") ?? deployment.rpcUrls[0]!;
}

/** Affiliate for a chain; defaults to the SDK registry's registered affiliate. */
export function getAffiliateAddress(chainId: number, fallback?: Address): Address {
  const deployment = getDeploymentByChainId(chainId);
  const specific = deployment.id === "arbitrum" ? "SYMMIO_ARBITRUM_AFFILIATE_ADDRESS" : "SYMMIO_BASE_AFFILIATE_ADDRESS";
  const value = readTrimmed(specific) ?? readTrimmed("SYMMIO_AFFILIATE_ADDRESS");
  if (!value) return fallback ?? getChainConfig(chainId).addresses.affiliatesAddress;
  if (!isAddress(value)) throw new Error(`${specific} must be a valid EVM address.`);
  return value;
}

/** A private key for the main wallet, if the operator supplied one. */
export function getEnvPrivateKey(): Hex | undefined {
  const value = readTrimmed("SYMMIO_PRIVATE_KEY");
  if (!value) return undefined;
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!isHex(normalized) || normalized.length !== 66) throw new Error("SYMMIO_PRIVATE_KEY must be 32-byte hex.");
  return normalized as Hex;
}

/** A read-only address to inspect when no private key is provided. */
export function getEnvAddress(): Address | undefined {
  const value = readTrimmed("SYMMIO_ADDRESS");
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error("SYMMIO_ADDRESS must be a valid EVM address.");
  return value;
}

/** WalletConnect / Reown Cloud project id, enabling the QR connect path. */
export function getWalletConnectProjectId(): string | undefined {
  return readTrimmed("SYMMIO_WALLETCONNECT_PROJECT_ID");
}

/** WalletConnect relay endpoint, overridable for a reachable relay/proxy. */
export function getWalletConnectRelayUrl(): string {
  return readTrimmed("SYMMIO_WALLETCONNECT_RELAY_URL") ?? "wss://relay.walletconnect.org";
}

/** Directory where the session-key keystore lives (holds a hot signer key). */
export function getKeystoreDir(): string {
  return readTrimmed("SYMMIO_KEYSTORE_DIR") ?? ".symmio";
}
