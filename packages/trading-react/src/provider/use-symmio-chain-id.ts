"use client";

import { useContext } from "react";
import { useChainId } from "wagmi";
import { SymmioChainIdContext } from "./symmio-chain-id-context";

/**
 * The chain id SDK hooks use when a hook's own `chainId` parameter is omitted
 * (an explicit `chainId` parameter still wins).
 *
 * Returns the chain pinned by {@link SymmioProvider}'s `chainId` prop when it is
 * set. Otherwise returns the chain the connected wallet is on, read from wagmi
 * (mirrors wagmi's `useChainId`).
 *
 * @returns The pinned chain id, or the connected wallet's chain id.
 *
 * @example
 * ```ts
 * const chainId = useSymmioChainId();
 * ```
 */
export function useSymmioChainId(): number {
  const pinnedChainId = useContext(SymmioChainIdContext);
  const connectedChainId = useChainId();
  return pinnedChainId ?? connectedChainId;
}
