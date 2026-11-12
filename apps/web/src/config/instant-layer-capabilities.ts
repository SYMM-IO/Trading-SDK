import { SymmioSupportedChainId } from "@symmio/trading-core";
import type { Address } from "viem";
import { GASLESS_DEPLOYMENTS } from "./symmio-presets";

/**
 * The InstantLayers known to have `grantDelegations` — the multi-delegate grant
 * perps-core added to v0.8.6 on 2026-09-04 — keyed by chain.
 *
 * The SDK cannot tell on its own: the function is in its ABI for every chain,
 * and an InstantLayer deployed before it reverts the call with no data. So this
 * app keeps the list, and an InstantLayer missing from it grants one delegate
 * per call — which every InstantLayer supports. A missing entry costs an extra
 * signature, never a failed grant.
 *
 * Probed 2026-10-13 with a read-only `grantDelegations([])` call: both entries
 * revert `InvalidDelegation` (the function exists and refuses the empty list),
 * while Arbitrum's previous production InstantLayer
 * `0xCB8F789d6f7e59B3D266490e1Aa8e35cFb755132` and Base's v0.8.5 one revert
 * with no data.
 */
const GRANT_DELEGATIONS_INSTANT_LAYERS: Readonly<Partial<Record<number, readonly Address[]>>> = {
  [SymmioSupportedChainId.ARBITRUM]: [
    /** Production — the SDK registry's Arbitrum InstantLayer since `@symmio/trading-core` 3.3.0. */
    "0x54c27E4bf1125391aA76e1D6497B069d91e179f6",
    GASLESS_DEPLOYMENTS.staging.instantLayerAddress,
  ],
};

/**
 * Whether an InstantLayer is known to have `grantDelegations`, so one call can
 * grant several delegates of an account.
 *
 * @param chainId - Chain the InstantLayer is deployed on. The same address on
 *   another chain is another contract.
 * @param instantLayerAddress - The InstantLayer the chain config names.
 * @returns `true` only for an InstantLayer listed in {@link GRANT_DELEGATIONS_INSTANT_LAYERS}.
 *
 * @example
 * ```ts
 * const chain = config.getChainConfig();
 * const oneCall = supportsGrantDelegations(chain.chainId, chain.addresses.instantLayerAddress);
 * ```
 */
export function supportsGrantDelegations(chainId: number, instantLayerAddress: string): boolean {
  const needle = instantLayerAddress.toLowerCase();
  return (GRANT_DELEGATIONS_INSTANT_LAYERS[chainId] ?? []).some((address) => address.toLowerCase() === needle);
}
