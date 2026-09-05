"use client";

import { ChartWithTable } from "@/components/chart-with-table";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { formatChartDate, formatChartDay, formatChartUsd, toChartUsd } from "@/lib/chart-format";
import { INVENTORY_VALUE_DECIMALS } from "@symmio/trading-core";
import { useInventoryTvlHistory } from "@symmio/trading-react";
import { AreaChart } from "@symmio/ui/components/area-chart";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { formatCompactCurrency } from "@symmio/utils";
import { formatUnits } from "@symmio/utils/decimal";
import { useMemo } from "react";
import { MethodCard } from "../inspector/method-card";
import { formatListingDate } from "./format-listing-value";
import { usePoolScope } from "./pool-scope";

/** One TVL snapshot, derived structurally from the hook's return type. */
type TvlPointRow = NonNullable<ReturnType<typeof useInventoryTvlHistory>["data"]>[number];

/**
 * One pool's custodial TVL over time — the series behind a pool page's TVL tab.
 *
 * The per-market twin of the page's headline `useInventoryTvl`: same vendor
 * (the inventory service, not the listing backend), one market instead of the
 * whole custodial system. The pool comes from the section's shared picker;
 * every snapshot the service holds for it is listed newest first.
 *
 * Public: no wallet and no listing sign-in. The route is not deployed on every
 * environment yet — where it is missing the service answers `404`, which shows
 * up here as a read error rather than an empty table.
 */
export function PoolTvlHistoryCard() {
  const { contractAddress } = usePoolScope();
  const history = useInventoryTvlHistory({ symbolAddress: contractAddress });
  const columns = useMemo<DataTableColumn<TvlPointRow>[]>(() => buildColumns(), []);
  /** The chart wants ascending milliseconds and plain numbers; the table keeps the exact `bigint`s. */
  const points = useMemo(
    () =>
      (history.data ?? [])
        .map((row) => ({ x: row.timestamp * 1000, y: toChartUsd(row.tvl, INVENTORY_VALUE_DECIMALS) }))
        .sort((a, b) => a.x - b.x),
    [history.data],
  );

  return (
    <MethodCard
      testId="method-getInventoryTvlHistory"
      name="useInventoryTvlHistory"
      mutability="view"
      description="One pool's custodial TVL over time, from the inventory service — the per-market twin of the page's system-wide TVL."
    >
      {contractAddress.length === 0 ? (
        <ResultNote testId="pool-tvl-history-idle">Pick a pool above to read its TVL history.</ResultNote>
      ) : history.error ? (
        <ResultError kind={history.error.kind} message={history.error.message} testId="pool-tvl-history-error" />
      ) : history.isPending ? (
        <TableSkeleton rows={4} columns={2} alignEndFrom={1} testId="pool-tvl-history-loading" />
      ) : history.data.length === 0 ? (
        <ResultNote testId="pool-tvl-history-empty">
          The inventory service holds no TVL snapshots for this pool.
        </ResultNote>
      ) : (
        <ChartWithTable
          chart={
            <AreaChart
              points={points}
              label="TVL over time"
              formatValue={formatChartUsd}
              formatX={formatChartDay}
              formatXDetail={formatChartDate}
              height={280}
              testId="pool-tvl-history-chart"
            />
          }
        >
          <DataTable
            testId="pool-tvl-history-data"
            columns={columns}
            data={history.data}
            totalCount={history.data.length}
            getRowId={(row) => String(row.timestamp)}
            initialSort={{ columnId: "timestamp", direction: "desc" }}
            hidePagination
            maxVisibleRows={7}
          />
        </ChartWithTable>
      )}
    </MethodCard>
  );
}

/** Build the TVL-history table columns. */
function buildColumns(): DataTableColumn<TvlPointRow>[] {
  return [
    {
      id: "timestamp",
      header: "Day",
      cell: (row) => formatListingDate(row.timestamp),
      sortAccessor: (row) => row.timestamp,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "tvl",
      header: "TVL",
      align: "end",
      cell: (row) => formatCompactCurrency(formatUnits(row.tvl, INVENTORY_VALUE_DECIMALS), { maxDecimals: 2 }),
      sortAccessor: (row) => Number(formatUnits(row.tvl, INVENTORY_VALUE_DECIMALS)),
      cellClassName: "text-foreground font-mono",
    },
  ];
}
