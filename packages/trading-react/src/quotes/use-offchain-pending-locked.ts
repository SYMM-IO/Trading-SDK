"use client";

import { useCallback, useMemo } from "react";
import type { Address } from "viem";
import { useManagedQuotes } from "./use-managed-quotes";

/**
 * Parameters for {@link useOffchainPendingLocked}.
 */
export interface UseOffchainPendingLockedParameters {
  /** The partyA whose off-chain quotes are summed. Disabled while undefined. */
  account?: Address;
  /** Target chain id. Defaults to the connected chain. */
  chainId?: number;
  /** Compute only when `true`. Default `true`. */
  enabled?: boolean;
  /**
   * Subscribe to the account's live notifications so the figure tracks quotes
   * being submitted and anchoring on-chain without a manual refresh.
   * @default false
   */
  live?: boolean;
}

/**
 * Value returned by {@link useOffchainPendingLocked}.
 */
export interface UseOffchainPendingLockedReturnType {
  /**
   * Σ locked legs (`cva + lf + partyAmm + partyBmm`) of the account's
   * **off-chain** quotes, wei — margin already committed to opens the chain
   * has not anchored yet, which `balanceInfoOfPartyA`'s locked/pending legs
   * therefore cannot know.
   */
  offchainPendingLocked: bigint;
  /** True while the quote pipeline is still loading. */
  isLoading: boolean;
  /** Force the underlying quote sources to refetch. */
  refetch: () => void;
}

/**
 * Margin locked by quotes that exist **only off-chain** so far (optimistic
 * instant-opens awaiting their on-chain anchor).
 *
 * Sourced from the managed (unified) quote pipeline, which owns the
 * off-chain → on-chain transition: the moment a quote anchors, reconciliation
 * flips its origin to on-chain, it leaves this sum, and the on-chain balance
 * snapshot's own locked/pending legs cover it from then on — never counted
 * twice, never dropped. Feed the figure to `calculateAvailableForOrder` as
 * `offchainPendingLocked`.
 *
 * @example
 * ```tsx
 * const { offchainPendingLocked } = useOffchainPendingLocked({ account: subAccount, live: true });
 * const available = calculateAvailableForOrder({ balanceInfo, upnl, offchainPendingLocked });
 * ```
 */
export function useOffchainPendingLocked(
  parameters: UseOffchainPendingLockedParameters = {},
): UseOffchainPendingLockedReturnType {
  const { account, chainId, enabled = true, live = false } = parameters;

  const managed = useManagedQuotes({
    partyA: account,
    chainId,
    live,
    enabled: enabled && Boolean(account),
  });

  const offchainPendingLocked = useMemo(
    () =>
      managed.quotes
        .filter((quote) => quote.origin === "offchain")
        .reduce(
          (sum, quote) =>
            sum +
            quote.lockedValues.cva +
            quote.lockedValues.lf +
            quote.lockedValues.partyAmm +
            quote.lockedValues.partyBmm,
          0n,
        ),
    [managed.quotes],
  );

  const { refetch: refetchManaged } = managed;
  const refetch = useCallback(() => {
    refetchManaged();
  }, [refetchManaged]);

  return { offchainPendingLocked, isLoading: managed.isLoading, refetch };
}
