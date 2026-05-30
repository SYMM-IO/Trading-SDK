"use client";

import { SymmError } from "@symm-frontier/core";
import { useMemo } from "react";
import { useSwitchChain } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioClient } from "../provider/use-symmio-client";

/**
 * Result shape returned by {@link useSwitchToSymmioChain}.
 */
export interface UseSwitchToSymmioChainResult {
  /**
   * Ask the connected wallet to switch to the SDK's configured chain. Resolves
   * after the wallet confirms; rejects with a {@link SymmioRequestError} (kind
   * `"user-rejected"` when the popup was dismissed).
   */
  switchChain: () => Promise<void>;
  /** wagmi's mutation status, passed through. */
  status: "idle" | "pending" | "success" | "error";
  /** Normalized error from the most recent attempt. */
  error?: SymmioRequestError;
}

/**
 * Asks the connected wallet to switch to the SDK's configured chain. The chain
 * id comes from the SDK client so callers don't repeat it.
 *
 * @example
 * const { isOnExpectedChain } = useWalletAccount();
 * const { switchChain, status } = useSwitchToSymmioChain();
 * if (!isOnExpectedChain) {
 *   return <button onClick={switchChain} disabled={status === "pending"}>Switch network</button>;
 * }
 */
export function useSwitchToSymmioChain(): UseSwitchToSymmioChainResult {
  const client = useSymmioClient();
  const { switchChainAsync, status, error } = useSwitchChain();

  const normalized = useMemo(() => (error ? normalizeSymmError(error) : undefined), [error]);

  return {
    status,
    error: normalized,
    switchChain: async () => {
      if (!client) {
        throw normalizeSymmError(new SymmError("SDK client not ready."));
      }
      try {
        await switchChainAsync({ chainId: client.config.chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  };
}
