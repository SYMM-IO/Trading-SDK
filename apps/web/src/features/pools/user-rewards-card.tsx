"use client";

import { ChartWithTable } from "@/components/chart-with-table";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { Stat } from "@/components/stat";
import { formatChartDate, formatChartDay, formatChartUsd, toChartUsd } from "@/lib/chart-format";
import { LISTING_VALUE_DECIMALS } from "@symmio/trading-core";
import { useUserRewardChart, useUserTotalReward } from "@symmio/trading-react";
import { BarChart, type BarChartBucket, type BarChartSeries } from "@symmio/ui/components/bar-chart";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import {
  depositChainLabel,
  formatListingDate,
  formatListingUsd,
  truncateContractAddress,
} from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { SignInNote } from "./sign-in-note";

/** Trailing window for the headline. The service caps `days` at 30. */
const WINDOW_DAYS = 30;

/**
 * How many pools get their own color in the stacked chart. The palette has
 * five validated slots; four go to the pools that earned most and the fifth is
 * the neutral "Other pools" bucket, so a wallet in twenty pools never cycles hues.
 */
const NAMED_SERIES = 4;

/** One market's reward series, derived structurally from the hook's return type. */
type UserRewardChartRow = NonNullable<ReturnType<typeof useUserRewardChart>["data"]>[number];

/** A flattened `(market, day)` row — the shape the table actually lists. */
interface UserRewardRow {
  id: string;
  marketAddress: string;
  marketChainId: UserRewardChartRow["marketChainId"];
  timestamp: number;
  reward: bigint;
}

/**
 * "Your rewards" — the signed-in user's LP rewards over time, across every pool
 * they earn in, plus the 30-day total.
 *
 * Both reads are authed and, unlike {@link UserProfitCard}, **not** scoped to one
 * pool: `useUserRewardChart` returns one series per market, so this card flattens
 * them into `(market, day)` rows rather than asking for a pool up front. A single
 * pool page would instead filter that response by `(marketAddress, marketChainId)`.
 *
 * The totals are built from **earned** daily snapshots, so claiming does not
 * reduce them — `useUserProfit` holds the claimable balance. `useUserTotalReward`
 * also wants the wallet address, so it stays idle until the wallet is connected
 * as well as signed in.
 */
export function UserRewardsCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken } = useListingAuth();
  const { address } = useAccount();

  const total = useUserTotalReward({
    accessToken: accessToken ?? "",
    userAddress: address ?? "",
    days: WINDOW_DAYS,
  });

  const chart = useUserRewardChart({ accessToken: accessToken ?? "" });

  const rows = useMemo<UserRewardRow[]>(() => flattenRewardCharts(chart.data), [chart.data]);
  const columns = useMemo<DataTableColumn<UserRewardRow>[]>(() => buildColumns(), []);
  const stacked = useMemo(() => toStackedSeries(chart.data), [chart.data]);

  const signedIn = accessToken !== null;
  const error = total.error ?? chart.error;

  return (
    <MethodCard
      testId="method-getUserRewardChart"
      name="useUserRewardChart + useUserTotalReward"
      mutability="view"
      description="Your LP rewards over time across every pool you earn in, plus the 30-day total. Authed, and not scoped to one pool. Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="user-rewards-gate">
          Switch to Enigma (HyperEVM) to sign in and read your rewards.
        </ResultNote>
      ) : !signedIn ? (
        <SignInNote testId="user-rewards-idle" buttonTestId="user-rewards-sign-in">
          Sign in to read your rewards.
        </SignInNote>
      ) : error ? (
        <ResultError kind={error.kind} message={error.message} testId="user-rewards-error" />
      ) : (
        <div className="flex flex-col gap-6" data-testid="user-rewards">
          <div className="border-info/30 bg-info/5 rounded-xl border p-4">
            <Stat
              label={`Earned · last ${WINDOW_DAYS} days`}
              value={address === undefined ? "—" : total.isPending ? "—" : formatListingUsd(total.data ?? 0n)}
              hint={
                address === undefined
                  ? "Connect a wallet — the endpoint takes the address as well as the token."
                  : "Across every pool. Earned, not claimable — claiming does not reduce it."
              }
            />
          </div>

          {chart.isPending ? (
            <TableSkeleton rows={4} columns={3} alignEndFrom={2} testId="user-rewards-loading" />
          ) : rows.length === 0 ? (
            <ResultNote testId="user-rewards-empty">You have no reward snapshots in any pool yet.</ResultNote>
          ) : (
            <ChartWithTable
              chart={
                <BarChart
                  series={stacked.series}
                  buckets={stacked.buckets}
                  label="Your daily rewards by pool"
                  formatValue={formatChartUsd}
                  formatX={formatChartDay}
                  formatXDetail={formatChartDate}
                  height={320}
                  testId="user-rewards-chart"
                />
              }
            >
              <DataTable
                testId="user-rewards-data"
                columns={columns}
                data={rows}
                totalCount={rows.length}
                getRowId={(row) => row.id}
                initialSort={{ columnId: "timestamp", direction: "desc" }}
                hidePagination
                maxVisibleRows={7}
              />
            </ChartWithTable>
          )}
        </div>
      )}
    </MethodCard>
  );
}

/**
 * Flatten the per-market response into one row per `(market, day)`, so a single
 * table can show which pool each reward came from.
 */
function flattenRewardCharts(charts: UserRewardChartRow[] | undefined): UserRewardRow[] {
  return (charts ?? []).flatMap((entry) =>
    entry.rewards.map((point) => ({
      id: `${entry.marketChainId}:${entry.marketAddress}:${point.timestamp}`,
      marketAddress: entry.marketAddress,
      marketChainId: entry.marketChainId,
      timestamp: point.timestamp,
      reward: point.reward,
    })),
  );
}

/**
 * Fold the per-market response into the stacked chart's shape: one series per
 * pool for the four that earned most, everything else summed into a neutral
 * "Other pools" series, and one bucket per day across all of them.
 *
 * Slots are assigned once, by lifetime total, so a pool keeps its color for as
 * long as this response is on screen — color follows the pool, not its rank on
 * any one day.
 */
function toStackedSeries(charts: UserRewardChartRow[] | undefined): {
  series: BarChartSeries[];
  buckets: BarChartBucket[];
} {
  if (!charts || charts.length === 0) return { series: [], buckets: [] };

  const ranked = charts
    .map((entry) => ({
      entry,
      total: entry.rewards.reduce((sum, point) => sum + point.reward, 0n),
    }))
    .sort((a, b) => (a.total === b.total ? 0 : a.total > b.total ? -1 : 1));

  const named = ranked.slice(0, NAMED_SERIES);
  const rest = ranked.slice(NAMED_SERIES);

  const series: BarChartSeries[] = named.map(({ entry }, index) => ({
    id: `${entry.marketChainId}:${entry.marketAddress}`,
    label: `${truncateContractAddress(entry.marketAddress)} · ${depositChainLabel(entry.marketChainId)}`,
    tone: (index + 1) as 1 | 2 | 3 | 4,
  }));
  if (rest.length > 0) series.push({ id: "other", label: "Other pools", tone: "muted" });

  /** `day → per-series USD`, in series order; a day a pool has no snapshot for stays zero. */
  const byDay = new Map<number, number[]>();
  const add = (timestamp: number, seriesIndex: number, reward: bigint) => {
    const x = timestamp * 1000;
    const values = byDay.get(x) ?? new Array<number>(series.length).fill(0);
    values[seriesIndex] = (values[seriesIndex] ?? 0) + toChartUsd(reward, LISTING_VALUE_DECIMALS);
    byDay.set(x, values);
  };
  named.forEach(({ entry }, index) => entry.rewards.forEach((point) => add(point.timestamp, index, point.reward)));
  rest.forEach(({ entry }) => entry.rewards.forEach((point) => add(point.timestamp, series.length - 1, point.reward)));

  const buckets = [...byDay.entries()].sort(([a], [b]) => a - b).map(([x, values]) => ({ x, values }));
  return { series, buckets };
}

/** Build the flattened reward table columns. */
function buildColumns(): DataTableColumn<UserRewardRow>[] {
  return [
    {
      id: "market",
      header: "Pool",
      cell: (row) => `${truncateContractAddress(row.marketAddress)} · ${depositChainLabel(row.marketChainId)}`,
      sortAccessor: (row) => row.marketAddress,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "timestamp",
      header: "Day",
      cell: (row) => formatListingDate(row.timestamp),
      sortAccessor: (row) => row.timestamp,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "reward",
      header: "Reward",
      align: "end",
      cell: (row) => formatListingUsd(row.reward),
      sortAccessor: (row) => Number(row.reward),
      cellClassName: "text-foreground font-mono",
    },
  ];
}
