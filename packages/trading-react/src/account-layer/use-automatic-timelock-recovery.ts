"use client";

import type { ConfigParameter } from "@symmio/trading-core";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { Address } from "viem";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { automaticAttemptKey, type AutomaticAttempt } from "./automatic-timelock-attempt";

/** Parameters for observing an automatic protected operation's recovery state. */
export type UseAutomaticTimelockRecoveryParameters = ConfigParameter & {
  /** Root sub-account whose policy governs the operation. */
  rootAccount: Address;
  /** Deployment chain; defaults to the connected chain. */
  chainId?: number;
};

/**
 * Observe and clear a reconciled automatic attempt in the current QueryClient.
 * A pending request cannot be cleared. The consumer must independently check
 * the outcome before clearing; this in-memory state does not survive reloads
 * or synchronize browser tabs. Applications needing durability must maintain
 * their own journal and lock across tabs, or supply their own routing.
 *
 * @param parameters - Root account and deployment.
 * @returns Attempt status and an explicit reconciliation acknowledgement.
 * @example const { status, clearAfterReconciliation } = useAutomaticTimelockRecovery({ rootAccount });
 */
export function useAutomaticTimelockRecovery(parameters: UseAutomaticTimelockRecoveryParameters) {
  const config = useSymmioConfig(parameters);
  const connectedChain = useSymmioChainId();
  const client = useQueryClient();
  const chainId = parameters.chainId ?? connectedChain;
  const key = automaticAttemptKey(
    chainId,
    config.getChainConfig(chainId).addresses.accountLayerAddress,
    parameters.rootAccount,
  );
  const status = useSyncExternalStore(
    (notify) => client.getQueryCache().subscribe(notify),
    () => client.getQueryData<AutomaticAttempt>(key)?.status ?? "idle",
    () => "idle" as const,
  );

  function clearAfterReconciliation() {
    const attempt = client.getQueryData<AutomaticAttempt>(key);
    if (attempt?.status === "pending") throw new Error("The protected operation is still pending.");
    if (attempt) client.removeQueries({ queryKey: key, exact: true });
  }

  return { status, clearAfterReconciliation };
}
