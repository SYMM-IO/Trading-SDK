"use client";

import { getDeployment, type Deployment } from "@/config/deployments";
import { useSupportsListingService } from "@symmio/trading-react";

/**
 * The deployment the whole Pools surface reads from.
 *
 * A pool is not a solver feature — it is a **chain** feature. The SDK resolves
 * the listing backend from the chain config's `listing` block, takes no
 * `solverId`, and in the shipped registry only HyperEVM carries one. So unlike
 * every other screen in Prism, Pools does not fan out: it names one deployment
 * and reads it wherever the wallet happens to sit.
 */
export const POOLS_DEPLOYMENT: Deployment = getDeployment("lowcaps");

/** The chain every pools read is addressed to, whatever the wallet is on. */
export const POOLS_CHAIN_ID = POOLS_DEPLOYMENT.chainId;

/**
 * Whether the pools chain actually carries a listing backend.
 *
 * `useSupportsListingService` is the SDK's own non-throwing gate. Every other
 * pools hook throws `LISTING_NOT_CONFIGURED` at request time on a chain without
 * a `listing` block, so this answer belongs in every `enabled` flag rather than
 * in a caught error — and it is asked about the pools chain explicitly, never
 * about the connected one.
 */
export function usePoolsSupported(): boolean {
  return useSupportsListingService({ chainId: POOLS_CHAIN_ID });
}
