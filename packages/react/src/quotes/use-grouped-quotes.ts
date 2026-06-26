"use client";

import {
  groupQuotes,
  partitionQuotes,
  SubAccountIsolationType,
  type GroupQuotesOptions,
  type QuoteGroup,
  type QuoteGroupingStrategy,
  type UnifiedQuote,
} from "@theoldvarorg/core";
import { useMemo } from "react";
import { useManagedQuotes, type UseManagedQuotesParameters, type UseManagedQuotesResult } from "./use-managed-quotes";

/**
 * Parameters for {@link useGroupedQuotes}. Everything {@link useManagedQuotes}
 * accepts, plus how to fold the resulting positions into groups.
 */
export interface UseGroupedQuotesParameters extends UseManagedQuotesParameters {
  /**
   * How to fold active positions into groups — a {@link SubAccountIsolationType}
   * (the built-in strategies) or a custom `{ keyOf }`. Defaults to
   * `MARKET_DIRECTION` (one group per market + side, the lowcap default).
   *
   * Passing a fresh `{ keyOf }` object every render recomputes the groups every
   * render; memoize a custom strategy if that matters.
   */
  strategy?: QuoteGroupingStrategy;
  /** Optional group-ordering override forwarded to `groupQuotes` (default newest-first). */
  groupSort?: GroupQuotesOptions["sort"];
}

/**
 * Value returned by {@link useGroupedQuotes} — the full {@link useManagedQuotes}
 * result, plus the grouped positions and the flat pending orders.
 */
export interface UseGroupedQuotesResult extends UseManagedQuotesResult {
  /** Active positions folded into {@link QuoteGroup}s under `strategy`, newest-first. */
  groups: QuoteGroup[];
  /** Resting/pending limit orders, kept flat (never grouped). */
  pending: UnifiedQuote[];
}

/**
 * Managed quotes for one sub-account, folded into grouped positions.
 *
 * Reads every quote source via {@link useManagedQuotes}, splits the merged list
 * into active positions and pending orders (`partitionQuotes`), then folds the
 * positions into {@link QuoteGroup}s under the chosen `strategy` (`groupQuotes`).
 * Pending limit orders are returned flat in `pending` — the grouped-positions vs
 * open-orders split. The full flat list stays available on `quotes`.
 *
 * All grouping is pure and runs in a `useMemo`, so the heavy work is the
 * underlying reads, not the fold.
 *
 * @param parameters - Managed-quotes parameters plus `strategy` / `groupSort`.
 * @returns The managed-quotes result extended with `groups` and `pending`.
 *
 * @example
 * ```tsx
 * const { groups, pending, isLoading } = useGroupedQuotes({ partyA });
 * // groups[0].metrics.openQuantity, groups[0].metrics.weightedOpenPrice, …
 *
 * // group by market instead of market + side:
 * useGroupedQuotes({ partyA, strategy: SubAccountIsolationType.MARKET });
 * ```
 */
export function useGroupedQuotes(parameters: UseGroupedQuotesParameters): UseGroupedQuotesResult {
  const { strategy = SubAccountIsolationType.MARKET_DIRECTION, groupSort, ...managedParameters } = parameters;
  const managed = useManagedQuotes(managedParameters);

  const { positions, pending } = useMemo(() => partitionQuotes(managed.quotes), [managed.quotes]);
  const groups = useMemo(
    () => groupQuotes(positions, strategy, groupSort ? { sort: groupSort } : undefined),
    [positions, strategy, groupSort],
  );

  return { ...managed, groups, pending };
}
