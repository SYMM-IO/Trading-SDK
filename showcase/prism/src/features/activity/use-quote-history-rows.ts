"use client";

import type { Deployment, MarketFamily } from "@/config/deployments";
import {
  getQuoteHistoryQueryOptions,
  type GetQuoteHistoryReturnType,
  type QuoteCloseType,
  type QuoteHistoryRow,
} from "@symmio/trading-core";
import { useSymmioConfig } from "@symmio/trading-react";
import { useQueries, type UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import type { DeploymentReadState } from "./activity-types";
import type { ActivityAccountGroup } from "./use-activity-accounts";

/** Rows per read. Deep enough for a blotter, shallow enough for one round-trip. */
const PAGE_SIZE = 100;

/** One history row, tagged with the deployment whose subgraph produced it. */
export interface ActivityQuoteRow {
  /** Stable across the merged list — event ids only have to be unique per subgraph. */
  key: string;
  row: QuoteHistoryRow;
  deployment: Deployment;
  family: MarketFamily;
}

export interface QuoteHistoryFanOut {
  /** Every deployment's rows, merged and sorted newest close first. */
  rows: readonly ActivityQuoteRow[];
  /** One entry per in-scope deployment, whether or not it answered. */
  states: readonly DeploymentReadState[];
  isLoading: boolean;
}

export interface UseQuoteHistoryRowsParameters {
  /** Read targets from `useActivityAccounts` — deployment × isolation type. */
  groups: readonly ActivityAccountGroup[];
  /** Every deployment the caller claims to cover, so a silent one still gets a state. */
  deployments: readonly Deployment[];
  closeType: QuoteCloseType;
}

/**
 * Closed and liquidated quote history for every in-scope deployment, merged.
 *
 * This is `useQuoteHistory` fanned out: that hook reads one `(chainId,
 * accounts)` pair and a hook cannot be called in a loop, so the same
 * `getQuoteHistoryQueryOptions` factory it wraps is fed to `useQueries` once per
 * read target instead. Cache keys already carry `chainId` and the resolved chain
 * config, so the two deployments never collide.
 *
 * **Pass the parent SubAccount — never a Virtual Account.** Verified in this
 * repo: `getQuoteHistory` filters the analytics subgraph on the quote's
 * `subAccount` field (or on `partyA` for cross-margin `CUSTOM` accounts), and a
 * lowcap quote's `subAccount` is the *parent* sub-account even though its
 * `partyA` is the VA that owns the position. Handing it a VA therefore matches
 * nothing and returns zero rows with no error — the failure mode looks exactly
 * like "no history". The SDK's own JSDoc suggests passing "a SubAccount and/or
 * its Virtual Accounts"; that is wrong for this read. The addresses here come
 * from `useFundingAccounts()`, which only ever yields sub-accounts.
 *
 * The on-chain reads elsewhere in the app are the exact inverse: they *require*
 * the VA fan-out, because positions live under VAs. The two must not be mixed up.
 */
export function useQuoteHistoryRows({
  groups,
  deployments,
  closeType,
}: UseQuoteHistoryRowsParameters): QuoteHistoryFanOut {
  const config = useSymmioConfig();

  const queries = useQueries({
    queries: groups.map(
      (group) =>
        getQuoteHistoryQueryOptions(config, {
          chainId: group.deployment.chainId,
          /* Parent SubAccounts only — a Virtual Account here returns zero rows
             and no error. See this function's doc comment. */
          subAccounts: group.accounts,
          isolationType: group.isolationType,
          closeType,
          first: PAGE_SIZE,
        }) as UseQueryOptions<GetQuoteHistoryReturnType, Error, GetQuoteHistoryReturnType, readonly unknown[]>,
    ),
  });

  return useMemo(() => {
    const rows: ActivityQuoteRow[] = [];
    const byFamily = new Map<MarketFamily, DeploymentReadState>();

    for (const deployment of deployments) {
      byFamily.set(deployment.family, {
        deployment,
        isLoading: false,
        error: null,
        rowCount: 0,
        attempted: false,
      });
    }

    groups.forEach((group, index) => {
      const query = queries[index];
      const state = byFamily.get(group.family);
      if (!state) return;

      state.attempted = true;
      state.isLoading = state.isLoading || (query?.isLoading ?? false);
      state.error = state.error ?? (query?.error as Error | null) ?? null;

      for (const row of query?.data?.rows ?? []) {
        state.rowCount += 1;
        rows.push({
          key: `${group.family}:${row.eventId}`,
          row,
          deployment: group.deployment,
          family: group.family,
        });
      }
    });

    rows.sort((a, b) => b.row.closedAt - a.row.closedAt);

    const states = [...byFamily.values()];
    return { rows, states, isLoading: states.some((state) => state.isLoading) };
  }, [groups, deployments, queries]);
}
