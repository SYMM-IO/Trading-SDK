"use client";

import { ChartWithTable } from "@/components/chart-with-table";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { Stat } from "@/components/stat";
import { formatChartDate, formatChartDay, formatChartUsd, toChartUsd } from "@/lib/chart-format";
import { LISTING_VALUE_DECIMALS, type ListingDepositChainId } from "@symmio/trading-core";
import { usePoolRewardChart, usePoolTotalReward } from "@symmio/trading-react";
import { BarChart, type BarChartSeries } from "@symmio/ui/components/bar-chart";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { Segmented, type SegmentedOption } from "../integration/segmented";
import { formatListingDate, formatListingUsd } from "./format-listing-value";
import { usePoolScope } from "./pool-scope";

/** One reward day, derived structurally from the hook's return type. */
type RewardRow = NonNullable<ReturnType<typeof usePoolRewardChart>["data"]>[number];

/** Trailing windows the headline offers. The service caps `days` at 30. */
type WindowDays = "7" | "14" | "30";

const WINDOW_OPTIONS: readonly SegmentedOption<WindowDays>[] = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

/** One series — the pool — so the chart draws plain bars and needs no legend. */
const REWARD_SERIES: readonly BarChartSeries[] = [{ id: "pool", label: "Pool rewards", tone: 1 }];

/**
 * A pool's LP rewards over time — the public series behind a pool page's rewards
 * tab, plus the trailing-window total shown above it.
 *
 * Two reads on one pool: `usePoolTotalReward` for the headline and
 * `usePoolRewardChart` for the daily rows. Both are public — no wallet, no
 * listing sign-in — and both address the pool by the pair
 * `(marketAddress, marketChainId)`, where the chain is the one the pool's **token**
 * lives on, not the chain the market trades on. That is why the section's
 * shared picker keeps the selected row and not just its address.
 *
 * The window is capped at 30 days by the service; a wider one is a `422`.
 */
export function PoolRewardsCard() {
  const { contractAddress, market, hasPool } = usePoolScope();
  const [windowDays, setWindowDays] = useState<WindowDays>("30");

  const marketChainId = (market?.chainId ?? 0) as ListingDepositChainId;

  const total = usePoolTotalReward({
    marketAddress: contractAddress,
    marketChainId,
    days: Number(windowDays),
    query: { enabled: hasPool },
  });

  const chart = usePoolRewardChart({
    marketAddress: contractAddress,
    marketChainId,
    query: { enabled: hasPool },
  });

  const columns = useMemo<DataTableColumn<RewardRow>[]>(() => buildColumns(), []);
  /** The combined error branch below hides the per-query narrowing, so read the rows defensively. */
  const rewards = useMemo(() => chart.data ?? [], [chart.data]);
  const buckets = useMemo(
    () =>
      rewards
        .map((row) => ({ x: row.timestamp * 1000, values: [toChartUsd(row.reward, LISTING_VALUE_DECIMALS)] }))
        .sort((a, b) => a.x - b.x),
    [rewards],
  );
  const error = total.error ?? chart.error;

  return (
    <MethodCard
      testId="method-getPoolRewardChart"
      name="usePoolRewardChart + usePoolTotalReward"
      mutability="view"
      description="A pool's daily LP rewards and its trailing-window total, from the listing backend. Public — no sign-in."
      wide
    >
      <Segmented
        groups={[WINDOW_OPTIONS]}
        value={windowDays}
        onChange={setWindowDays}
        aria-label="Total reward window"
      />

      {!hasPool ? (
        <ResultNote testId="pool-rewards-idle">Pick a pool above to read its rewards.</ResultNote>
      ) : error ? (
        <ResultError kind={error.kind} message={error.message} testId="pool-rewards-error" />
      ) : (
        <div className="flex flex-col gap-6" data-testid="pool-rewards">
          <div className="border-info/30 bg-info/5 rounded-xl border p-4">
            <Stat
              label={`Rewards · last ${windowDays} days`}
              value={total.isPending || total.data === undefined ? "—" : formatListingUsd(total.data)}
              hint="Earned from daily snapshots, so claiming does not reduce it."
            />
          </div>

          {chart.isPending ? (
            <TableSkeleton rows={4} columns={2} alignEndFrom={1} testId="pool-rewards-loading" />
          ) : rewards.length === 0 ? (
            <ResultNote testId="pool-rewards-empty">This pool has no reward snapshots yet.</ResultNote>
          ) : (
            <ChartWithTable
              chart={
                <BarChart
                  series={REWARD_SERIES}
                  buckets={buckets}
                  label="Daily rewards"
                  formatValue={formatChartUsd}
                  formatX={formatChartDay}
                  formatXDetail={formatChartDate}
                  height={320}
                  testId="pool-rewards-chart"
                />
              }
            >
              <DataTable
                testId="pool-rewards-data"
                columns={columns}
                data={rewards}
                totalCount={rewards.length}
                getRowId={(row) => String(row.timestamp)}
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

/** Build the daily-reward table columns. */
function buildColumns(): DataTableColumn<RewardRow>[] {
  return [
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
