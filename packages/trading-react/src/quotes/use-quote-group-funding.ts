"use client";

import {
  aggregateGroupFunding,
  type ConfigParameter,
  type GetQuoteFundingOptions,
  type QuoteFundingData,
  type QuoteGroup,
  type QuoteGroupFunding,
} from "@symmio/trading-core";
import { useMemo } from "react";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useQuotesFunding } from "./use-quotes-funding";

/**
 * Parameters for {@link useQuoteGroupFunding}.
 */
export interface UseQuoteGroupFundingParameters extends Omit<GetQuoteFundingOptions, "quoteIds">, ConfigParameter {
  /** The group to read settled funding for. */
  group: QuoteGroup;
}

/**
 * Return type of {@link useQuoteGroupFunding}.
 */
export interface UseQuoteGroupFundingReturnType {
  /** Aggregated settled funding for the group. */
  funding: QuoteGroupFunding;
  /** Funding row per child quote, aligned 1:1 with `group.quotes`; `null` when unresolved. */
  rows: Array<QuoteFundingData | null>;
  /** `true` while the underlying subgraph query is loading. */
  isLoading: boolean;
  /** Normalized request error, when one occurred. */
  error: SymmioRequestError | null;
}

/**
 * Read the settled funding of a whole {@link QuoteGroup} — the group-level
 * counterpart of `useQuoteFunding`.
 *
 * Every child quote's funding is fetched in one subgraph round-trip via
 * {@link useQuotesFunding}, then folded by core's pure `aggregateGroupFunding`.
 * All arithmetic lives in core; this hook only wires the read to the fold and
 * memoizes the result, so the returned object is referentially stable while the
 * group and its rows are unchanged.
 *
 * **Sign convention** — `funding.net = paid − received`, so a **positive** `net`
 * means the group has net-**paid** funding; negative means it net-**received**
 * it. This matches {@link QuoteFundingData} and the on-chain `int256`. A UI that
 * wants the "green = income" coloring (as the reference app renders it) must
 * negate `net` at the render layer — never here.
 *
 * **Check `funding.isComplete` before presenting the total as final.** `net` is
 * always the sum over the children that resolved, i.e. a lower bound while the
 * subgraph is still indexing (`funding.missingQuoteIds` non-empty). An
 * all-optimistic or empty group reports `isComplete: false` with `net: 0n`, so
 * treat `isComplete: false` as "funding unknown", not as "no funding".
 *
 * **Settled to date only** — these totals cover funding the protocol has already
 * charged and the analytics subgraph has indexed. Funding accrued since a
 * quote's last funding charge is not indexed anywhere and is therefore not
 * included.
 *
 * @param parameters - The group to read, plus optional chain/query/config overrides.
 * @returns The aggregated group funding, the per-child rows, and query state.
 *
 * @example
 * ```tsx
 * function GroupedPositionCard({ group }: { group: QuoteGroup }) {
 *   const { funding, isLoading } = useQuoteGroupFunding({ group });
 *
 *   if (isLoading || !funding.isComplete) return <FundingSkeleton />;
 *
 *   // `net > 0n` means the group net-PAID funding. Negate for "green = income".
 *   return <Money amount={-funding.net} label="Funding" />;
 * }
 * ```
 */
export function useQuoteGroupFunding(parameters: UseQuoteGroupFundingParameters): UseQuoteGroupFundingReturnType {
  const { group, ...rest } = parameters;
  const quotes = group.quotes;

  /** One batched round-trip for the whole group; de-duping and off-chain skipping live there. */
  const batch = useQuotesFunding({ quotes, ...rest });
  const rows = batch.rows;

  const funding = useMemo(() => {
    const resolvedRows = rows.filter((row): row is QuoteFundingData => row !== null);
    return aggregateGroupFunding(quotes, resolvedRows);
  }, [quotes, rows]);

  return useMemo(
    () => ({ funding, rows, isLoading: batch.isLoading, error: batch.error }),
    [funding, rows, batch.isLoading, batch.error],
  );
}
