"use client";

import {
  FUNDING_HISTORY_EVENT_TYPES,
  getQuotesEventsByTypeQueryOptions,
  type ConfigParameter,
  type GetQuotesEventsByTypeOptions,
  type GetQuotesEventsByTypeReturnType,
  type QuoteGroup,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useQuoteGroupFundingHistory}: the batched core query
 * options minus the two fields this hook owns — `quoteIds` (derived from the
 * group's children) and `types` (locked to {@link FUNDING_HISTORY_EVENT_TYPES}) —
 * plus an optional `config`.
 */
export type UseQuoteGroupFundingHistoryParameters = Omit<GetQuotesEventsByTypeOptions, "quoteIds" | "types"> &
  ConfigParameter & {
    /** The group whose children's funding ticks are merged into one timeline. */
    group: QuoteGroup;
  };

/** Return type of {@link useQuoteGroupFundingHistory}. */
export type UseQuoteGroupFundingHistoryReturnType = UseQueryResult<GetQuotesEventsByTypeReturnType, SymmioRequestError>;

/**
 * Read the funding history of a whole {@link QuoteGroup} as **one merged,
 * time-sorted timeline** — the group analogue of `useQuotePriceHistory`.
 *
 * Every on-chain child of the group is fetched in a single subgraph round-trip
 * and the rows come back already interleaved and sorted by `timestamp` (newest
 * first unless `orderDirection: "asc"` is passed). Each row carries its own
 * `quoteId`, so a caller that wants a per-position breakdown groups by that
 * field client-side.
 *
 * Per-row funding fields are `fundingPaid` / `fundingReceived` (18-decimal wei)
 * plus the `rate` applied for that tick (a signed `int256` as wei). The sign
 * convention when netting a row is `net = fundingPaid - fundingReceived`: a
 * **positive** net means the user net-**paid** funding. This matches
 * `QuoteFundingData.net` and the on-chain `int256`. A UI that colors "money in"
 * green wants the inverse — do that inversion in the UI, not here.
 *
 * Children with no on-chain `quoteId` (optimistic rows that have not anchored
 * yet) have no subgraph events and are dropped from the request; ids are
 * de-duplicated so a group holding the same quote twice does not fragment the
 * cache. When the group has no on-chain children the query stays disabled.
 *
 * Paging is over the **merged** stream, not per quote id: pass `first` / `skip`
 * and page while `data.hasMore` is `true`. Omitting `first` asks for the 1000-row
 * ceiling the subgraph enforces, so an un-paged call loads the whole timeline
 * unless the group has more ticks than a single request can return.
 *
 * `chainId` defaults to the connected chain. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @remarks
 * This is funding **settled to date** — what the analytics subgraph has indexed.
 * Funding that has accrued since the last on-chain charge is not indexed and is
 * therefore absent from this timeline.
 *
 * @remarks
 * On current deployments effectively every row is `CHARGE_FUNDING_RATE`.
 * `CHARGE_ACCUMULATED_FUNDING_FEE` is part of {@link FUNDING_HISTORY_EVENT_TYPES}
 * for completeness but is not yet emitted, so do not rely on seeing it.
 *
 * @param parameters - The group, optional paging/sort/chain id, TanStack `query`
 *   overrides, and an optional `config`.
 * @returns A TanStack query result holding the merged `rows` and a `hasMore` flag.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useQuoteGroupFundingHistory({ group, first: 100 });
 *
 * for (const row of data?.rows ?? []) {
 *   const net = (row.fundingPaid ?? 0n) - (row.fundingReceived ?? 0n);
 *   // net > 0n → the user paid funding on this tick.
 * }
 * ```
 */
export function useQuoteGroupFundingHistory(
  parameters: UseQuoteGroupFundingHistoryParameters,
): UseQuoteGroupFundingHistoryReturnType {
  const { group, ...rest } = parameters;
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  /**
   * On-chain ids of the group's children: optimistic rows (no `quoteId`) have no
   * subgraph events and are dropped, and duplicates are collapsed so the query
   * key stays stable.
   */
  const quoteIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: bigint[] = [];
    for (const quote of group.quotes) {
      if (quote.quoteId === undefined) continue;
      const key = quote.quoteId.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      ids.push(quote.quoteId);
    }
    return ids;
  }, [group.quotes]);

  const options = getQuotesEventsByTypeQueryOptions(config, {
    ...rest,
    chainId: rest.chainId ?? chainId,
    quoteIds,
    types: FUNDING_HISTORY_EVENT_TYPES,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseQuoteGroupFundingHistoryReturnType;
}
