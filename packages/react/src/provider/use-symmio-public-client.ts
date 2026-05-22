"use client";

import type { PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { useSymmioConfig } from "./use-symmio-config";

/**
 * Resolve a viem `PublicClient` for the SDK's configured chain, using the
 * host's wagmi config. Returns `undefined` when wagmi has no transport bound
 * for the configured chain (the host's wagmi config left it out).
 *
 * @internal — consumed by domain hooks like `useUserSubAccounts`. Host apps
 *   should call wagmi's `usePublicClient` directly when they need a client
 *   outside the SDK boundary.
 */
export function useSymmioPublicClient(): PublicClient | undefined {
  const config = useSymmioConfig();
  return usePublicClient({ chainId: config.chainId });
}
