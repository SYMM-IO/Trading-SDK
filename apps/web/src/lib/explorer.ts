"use client";

import { useMemo } from "react";
import { useChainId, useChains } from "wagmi";

/** Explorer link builders bound to one chain; each returns `undefined` when that chain ships no explorer. */
export interface BlockExplorer {
  addressUrl: (address: string) => string | undefined;
  txUrl: (hash: string) => string | undefined;
}

/**
 * Resolves block-explorer links for the active wagmi chain (the one picked in
 * the header chain switcher), using the explorer from viem's chain definition
 * so no base URL is hard-coded. Every tx and address the app renders lives on
 * that chain, so links follow it when the user switches network.
 */
export function useBlockExplorer(): BlockExplorer {
  const chainId = useChainId();
  const chains = useChains();
  const baseUrl = chains.find((chain) => chain.id === chainId)?.blockExplorers?.default.url;

  return useMemo(
    () => ({
      addressUrl: (address) => (baseUrl ? `${baseUrl}/address/${address}` : undefined),
      txUrl: (hash) => (baseUrl ? `${baseUrl}/tx/${hash}` : undefined),
    }),
    [baseUrl],
  );
}
