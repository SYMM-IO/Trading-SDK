"use client";

import { useChainId } from "wagmi";

/**
 * The chain id the connected wallet is currently on, read from wagmi. SDK hooks
 * use it as the default `chainId` for reads and writes (a hook's explicit
 * `chainId` parameter still wins). Mirrors wagmi's `useChainId`.
 *
 * @returns The active chain id.
 *
 * @example
 * ```ts
 * const chainId = useSymmioChainId();
 * ```
 */
export function useSymmioChainId(): number {
  return useChainId();
}
