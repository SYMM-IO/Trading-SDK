"use client";

import {
  assertQuoteGroupingSupported,
  groupQuotes,
  partitionQuotes,
  SubAccountIsolationType,
  supportsQuoteGrouping,
  type GroupQuotesOptions,
  type QuoteGroup,
  type QuoteGroupingStrategy,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useEffect, useMemo, useRef } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useGroupingIsolation } from "./use-grouping-isolation";
import { useManagedQuotes, type UseManagedQuotesParameters, type UseManagedQuotesResult } from "./use-managed-quotes";

/** Stable empty result for the guarded case, so `groups` keeps its identity across renders. */
const NO_GROUPS: QuoteGroup[] = [];

/**
 * Parameters for {@link useGroupedQuotes}. Everything {@link useManagedQuotes}
 * accepts, plus how to fold the resulting positions into groups.
 */
export interface UseGroupedQuotesParameters extends UseManagedQuotesParameters {
  /**
   * How to fold active positions into groups. The only
   * {@link SubAccountIsolationType} accepted is `MARKET_DIRECTION` (one group per
   * market + side), which is also the default — grouped positions are defined for
   * that isolation alone. Passing any other isolation type throws
   * `UNSUPPORTED_GROUPING_ISOLATION`; pass a custom `{ keyOf }` to fold on another
   * dimension (`keyQuoteByMarket` / `keyQuotePerQuote` cover the common cases).
   *
   * A custom `{ keyOf }` also opts out of the sub-account isolation check below.
   * Passing a fresh `{ keyOf }` object every render recomputes the groups every
   * render; memoize a custom strategy if that matters.
   */
  strategy?: QuoteGroupingStrategy;
  /** Optional group-ordering override forwarded to `groupQuotes` (default newest-first). */
  groupSort?: GroupQuotesOptions["sort"];
}

/**
 * Value returned by {@link useGroupedQuotes} — the full {@link useManagedQuotes}
 * result, plus the grouped positions, the flat pending orders, and the
 * isolation check that decides whether grouping applies at all.
 */
export interface UseGroupedQuotesResult extends UseManagedQuotesResult {
  /**
   * Active positions folded into {@link QuoteGroup}s under `strategy`,
   * newest-first. Always empty while {@link isGroupingSupported} is `false`.
   */
  groups: QuoteGroup[];
  /** Resting/pending limit orders, kept flat (never grouped). */
  pending: UnifiedQuote[];
  /**
   * Isolation type of the sub-account owning `partyA` (resolved through the
   * Virtual Account's parent when `partyA` is a VA). `undefined` while the read
   * is in flight, when `partyA` is neither a sub-account nor a VA, and when a
   * custom `{ keyOf }` strategy skipped the lookup.
   */
  isolationType?: SubAccountIsolationType;
  /**
   * `false` only when the owning sub-account's isolation is **known** and is not
   * `MARKET_DIRECTION`. `true` while the isolation is unresolved, so a consumer
   * gating on it never flashes an error state during the read.
   */
  isGroupingSupported: boolean;
  /** The rejection behind `isGroupingSupported: false`; `null` otherwise. */
  groupingError: SymmioRequestError | null;
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
 * **Grouping is a `MARKET_DIRECTION`-only feature.** It is the one isolation
 * where a market + side cohort is a real on-chain unit (the AccountLayer
 * allocates one Virtual Account per market + direction), so folding that cohort
 * into a single row aggregates values that belong together — and group-level
 * actions (group close, group TP/SL) act on quotes that really share a VA. This
 * hook therefore resolves the isolation of the sub-account owning `partyA`
 * (walking up from a Virtual Account to its parent when needed) and, when that
 * isolation is anything else, returns **no groups** together with
 * `isGroupingSupported: false` and a `groupingError` instead of silently folding
 * unrelated positions. `quotes` and `pending` are untouched, so a consumer can
 * still render flat rows for those accounts. The lookup is skipped for a custom
 * `{ keyOf }` strategy — that caller has opted out of isolation-based grouping.
 *
 * All grouping is pure and runs in a `useMemo`, so the heavy work is the
 * underlying reads, not the fold.
 *
 * @param parameters - Managed-quotes parameters plus `strategy` / `groupSort`.
 * @returns The managed-quotes result extended with `groups`, `pending`, and the isolation check.
 * @throws {SymmError} `UNSUPPORTED_GROUPING_ISOLATION` when `strategy` is an
 *   isolation type other than `MARKET_DIRECTION`.
 *
 * @example
 * ```tsx
 * const { groups, pending, isGroupingSupported, groupingError } = useGroupedQuotes({ partyA });
 * if (!isGroupingSupported) return <FlatPositions rows={pending} note={groupingError?.message} />;
 * // groups[0].metrics.openQuantity, groups[0].metrics.weightedOpenPrice, …
 *
 * // fold on another dimension — opts out of the isolation check:
 * useGroupedQuotes({ partyA, strategy: { keyOf: keyQuoteByMarket } });
 * ```
 */
export function useGroupedQuotes(parameters: UseGroupedQuotesParameters): UseGroupedQuotesResult {
  const { strategy = SubAccountIsolationType.MARKET_DIRECTION, groupSort, ...managedParameters } = parameters;
  const managed = useManagedQuotes(managedParameters);

  /**
   * The sub-account check only applies to isolation-backed grouping; a custom
   * `{ keyOf }` groups on the consumer's own dimension, so no on-chain isolation
   * can contradict it and no read is worth firing.
   */
  const isIsolationStrategy = typeof strategy !== "object";
  const isolationType = useGroupingIsolation({
    account: parameters.partyA,
    chainId: parameters.chainId,
    enabled: isIsolationStrategy && (parameters.enabled ?? true),
  });

  /**
   * Unresolved isolation reads as supported — never flash a failure while loading.
   * A custom `{ keyOf }` strategy opted out of the isolation gate entirely, so it
   * is always supported regardless of any isolation the lookup might surface.
   */
  const isGroupingSupported =
    !isIsolationStrategy || isolationType === undefined || supportsQuoteGrouping(isolationType);

  const groupingError = useMemo<SymmioRequestError | null>(() => {
    if (isolationType === undefined || isGroupingSupported) return null;
    try {
      assertQuoteGroupingSupported(isolationType);
      return null;
    } catch (err) {
      return normalizeSymmError(err);
    }
  }, [isolationType, isGroupingSupported]);

  const { positions, pending } = useMemo(() => partitionQuotes(managed.quotes), [managed.quotes]);
  const groups = useMemo(() => {
    /** An unsupported `strategy` is a caller bug — throw even when the guard already blanked the groups. */
    if (typeof strategy !== "object") assertQuoteGroupingSupported(strategy);
    if (!isGroupingSupported) return NO_GROUPS;
    return groupQuotes(positions, strategy, groupSort ? { sort: groupSort } : undefined);
  }, [positions, strategy, groupSort, isGroupingSupported]);

  /**
   * Blanked groups are easy to misread as "no positions", so say why once per
   * account — in development only, and keyed so a re-render never re-logs.
   */
  const warnedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!groupingError || process.env.NODE_ENV === "production") return;
    const key = `${parameters.partyA}:${isolationType}`;
    if (warnedRef.current === key) return;
    warnedRef.current = key;
    console.warn(`[useGroupedQuotes] ${groupingError.message} No groups are returned; read \`quotes\` instead.`);
  }, [groupingError, isolationType, parameters.partyA]);

  return { ...managed, groups, pending, isolationType, isGroupingSupported, groupingError };
}
