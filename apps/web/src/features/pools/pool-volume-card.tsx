"use client";

import { ChartWithTable } from "@/components/chart-with-table";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { formatChartDate, formatChartDay, formatChartUsd } from "@/lib/chart-format";
import { toVolumeBuckets } from "@/lib/volume-buckets";
import { useTradeVolume } from "@symmio/trading-react";
import { BarChart, type BarChartSeries } from "@symmio/ui/components/bar-chart";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { useMemo } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { usePoolScope } from "./pool-scope";

/** One daily-volume row, derived structurally from the hook's return type. */
type VolumeRow = NonNullable<ReturnType<typeof useTradeVolume>["data"]>[number];

/** One series — the pool's market — so the chart draws plain bars and needs no legend. */
const VOLUME_SERIES: readonly BarChartSeries[] = [{ id: "volume", label: "Daily volume", tone: 1 }];

/**
 * One pool's traded volume per day — the series behind a pool page's volume tab.
 *
 * The third vendor on a pool page: TVL comes from the inventory service and
 * rewards from the listing backend, but volume is the **solver's** bookkeeping,
 * read by the pool's solver market id rather than its token address. That id
 * only exists once the pool is `LISTED`, so an unlisted pool has no volume to
 * show — not an empty chart, a different state.
 *
 * Enigma-only: `/trade-volume` is an Enigma endpoint, so the read stays idle on
 * any other solver instead of failing on the wire.
 */
export function PoolVolumeCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { market, hasPool } = usePoolScope();

  const symbolId = market?.symbolId ?? null;

  const volume = useTradeVolume({
    symbolId: symbolId ?? 0,
    query: { enabled: enigmaActive && hasPool && symbolId !== null },
  });

  const columns = useMemo<DataTableColumn<VolumeRow>[]>(() => buildColumns(), []);
  const buckets = useMemo(() => toVolumeBuckets(volume.data), [volume.data]);

  return (
    <MethodCard
      testId="method-getPoolTradeVolume"
      name="useTradeVolume"
      mutability="view"
      description="One pool's traded notional per day, from the solver — keyed by the pool's solver market id, so only a listed pool has a series. Enigma-only."
    >
      {!enigmaActive ? (
        <ResultNote testId="pool-volume-gate">Switch to Enigma (HyperEVM) to read a pool’s volume.</ResultNote>
      ) : !hasPool ? (
        <ResultNote testId="pool-volume-idle">Pick a pool above to read its daily volume.</ResultNote>
      ) : symbolId === null ? (
        <ResultNote testId="pool-volume-unlisted">
          This pool is not listed yet, so it has no solver market and no volume to read.
        </ResultNote>
      ) : volume.error ? (
        <ResultError kind={volume.error.kind} message={volume.error.message} testId="pool-volume-error" />
      ) : volume.isPending ? (
        <TableSkeleton rows={4} columns={2} alignEndFrom={1} testId="pool-volume-loading" />
      ) : volume.data.length === 0 ? (
        <ResultNote testId="pool-volume-empty">The solver reports no trades on this market yet.</ResultNote>
      ) : (
        <ChartWithTable
          chart={
            <BarChart
              series={VOLUME_SERIES}
              buckets={buckets}
              label="Daily trade volume"
              formatValue={formatChartUsd}
              formatX={formatChartDay}
              formatXDetail={formatChartDate}
              height={280}
              testId="pool-volume-chart"
            />
          }
        >
          <DataTable
            testId="pool-volume-data"
            columns={columns}
            data={volume.data}
            totalCount={volume.data.length}
            getRowId={(row) => row.timestamp}
            initialSort={{ columnId: "timestamp", direction: "desc" }}
            hidePagination
            maxVisibleRows={7}
          />
        </ChartWithTable>
      )}
    </MethodCard>
  );
}

/** Build the daily-volume table columns. */
function buildColumns(): DataTableColumn<VolumeRow>[] {
  return [
    {
      id: "timestamp",
      header: "Day",
      cell: (row) => formatChartDate(Date.parse(row.timestamp)),
      sortAccessor: (row) => row.timestamp,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "volume",
      header: "Volume",
      align: "end",
      cell: (row) => formatChartUsd(Number(row.volume) || 0),
      sortAccessor: (row) => Number(row.volume) || 0,
      cellClassName: "text-foreground font-mono",
    },
  ];
}
