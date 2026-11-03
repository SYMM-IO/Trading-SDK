"use client";

import { supportsGrantDelegations } from "@/config/instant-layer-capabilities";
import { useSymmioConfig } from "@symmio/trading-react";

/**
 * Whether the active chain's InstantLayer has `grantDelegations`, so one call —
 * one owner signature when relayed — can grant several delegates.
 *
 * Reads the chain a grant with no `chainId` goes to (the SDK config's default,
 * which follows the connected wallet), so the answer describes the InstantLayer
 * the next grant targets. `false` means "not known to"; grant one delegate per
 * call instead.
 *
 * @returns `true` when the InstantLayer is on the app's `grantDelegations` list.
 *
 * @example
 * ```tsx
 * const oneCall = useSupportsGrantDelegations();
 * ```
 */
export function useSupportsGrantDelegations(): boolean {
  const chain = useSymmioConfig().getChainConfig();
  return supportsGrantDelegations(chain.chainId, chain.addresses.instantLayerAddress);
}
