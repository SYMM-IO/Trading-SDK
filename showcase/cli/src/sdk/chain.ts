import type { Config, SolverId } from "@symmio/trading-core";
import type { Address } from "viem";

/** The merged SYMMIO chain config (addresses, solver, price service, …). */
export function chainConfig(config: Config, chainId: number) {
  return config.getChainConfig(chainId);
}

/** Collateral token decimals (e.g. 6 for USDC) — for deposit/withdraw amounts. */
export function collateralDecimals(config: Config, chainId: number): number {
  return chainConfig(config, chainId).addresses.collateralDecimals;
}

/** The affiliate attached to every quote and sub-account creation. */
export function affiliateAddress(config: Config, chainId: number): Address {
  return chainConfig(config, chainId).addresses.affiliatesAddress;
}

/** The SYMMIO core (diamond) address — approve spender + sub-account core. */
export function symmioCoreAddress(config: Config, chainId: number): Address {
  return chainConfig(config, chainId).addresses.symmioAddress;
}

/** The conditional-order-handler wallet for TP/SL, if the chain configures it. */
export function cohWalletAddress(config: Config, chainId: number, solverId: SolverId): Address | undefined {
  return config.getSolver({ chainId, solverId }).tpsl?.cohWalletAddress;
}
