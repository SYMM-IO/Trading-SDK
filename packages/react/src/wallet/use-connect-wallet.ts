"use client";

import { useMemo } from "react";
import { useConnect, type Connector } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Result shape returned by {@link useConnectWallet}.
 */
export interface UseConnectWalletResult {
  /** Connectors registered in the host's wagmi config. */
  connectors: readonly Connector[];
  /**
   * Initiate a wallet connection. Resolves once the user has accepted the
   * popup; rejects with a {@link SymmioRequestError} (kind `"user-rejected"`
   * when the popup was dismissed).
   */
  connect: (connector: Connector) => Promise<void>;
  /** wagmi's mutation status, passed through for UI binding. */
  status: "idle" | "pending" | "success" | "error";
  /** Normalized error if the most recent connect attempt failed. */
  error?: SymmioRequestError;
}

/**
 * Wraps wagmi's `useConnect` with the SDK's error normalization. The host app
 * decides which connectors are available (injected, walletConnect, mock, etc.)
 * via its wagmi config; this hook just surfaces them.
 *
 * @example
 * const { connectors, connect, status, error } = useConnectWallet();
 * return connectors.map((c) => (
 *   <button key={c.id} onClick={() => connect(c)} disabled={status === "pending"}>
 *     {c.name}
 *   </button>
 * ));
 */
export function useConnectWallet(): UseConnectWalletResult {
  const { connectAsync, connectors, status, error } = useConnect();

  const normalized = useMemo(() => (error ? normalizeSymmError(error) : undefined), [error]);

  return {
    connectors,
    status,
    error: normalized,
    connect: async (connector) => {
      try {
        await connectAsync({ connector });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  };
}
