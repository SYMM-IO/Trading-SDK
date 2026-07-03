"use client";

import { useDisconnect } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";

/**
 * Result shape returned by {@link useDisconnectWallet}.
 */
export interface UseDisconnectWalletResult {
  /** Disconnect the currently connected wallet. */
  disconnect: () => Promise<void>;
  /** wagmi's mutation status, passed through. */
  status: "idle" | "pending" | "success" | "error";
}

/**
 * Wraps wagmi's `useDisconnect`. Errors are normalized to `SymmioRequestError`
 * before being thrown so callers can use a single error handling path across
 * connect, disconnect, and switch-chain.
 *
 * @example
 * const { disconnect } = useDisconnectWallet();
 * <button onClick={() => disconnect()}>Disconnect</button>;
 */
export function useDisconnectWallet(): UseDisconnectWalletResult {
  const { mutateAsync, status } = useDisconnect();

  return {
    status,
    disconnect: async () => {
      try {
        await mutateAsync();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  };
}
