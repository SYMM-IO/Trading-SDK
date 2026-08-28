"use client";

import { ChartWithTable } from "@/components/chart-with-table";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import { formatChartDate, formatChartDay, formatChartUsd } from "@/lib/chart-format";
import { toVolumeBuckets } from "@/lib/volume-buckets";
import { useTradeVolume } from "@symmio/trading-react";
import { BarChart, type BarChartSeries } from "@symmio/ui/components/bar-chart";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { SolverTargetSelect, useSolverKindActive, useSolverTargetState } from "./solver-target";

/** Default market id — the first solver market. */
const DEFAULT_SYMBOL_ID = 1;

/** Formats an ISO day bucket as a stable UTC date (e.g. `Jul 9, 2026`). */
const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** One daily-volume row, derived structurally from the hook's return type. */
type VolumeRow = NonNullable<ReturnType<typeof useTradeVolume>["data"]>[number];

/** One series — the market — so the chart draws plain bars and needs no legend. */
const VOLUME_SERIES: readonly BarChartSeries[] = [{ id: "volume", label: "Daily volume", tone: 1 }];

/**
 * Solvers-page card for `/trade-volume/{symbolId}` — the enigma solver's last N
 * daily trade-volume rows for one market. Enter a numeric symbol id (default
 * {@link DEFAULT_SYMBOL_ID}) and refresh; the table lists each day's bucket and
 * notional traded. **Enigma-only**: the query is gated to the Enigma solver and
 * stays idle on other chains (it 404s on Rasa/Base).
 */
export function ReadTradeVolumeCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "enigma" });
  const active = useSolverKindActive("enigma");
  const [symbolIdInput, setSymbolIdInput] = useState(String(DEFAULT_SYMBOL_ID));
  const symbolId = Number(symbolIdInput) || 0;
  const query = useTradeVolume({
    symbolId,
    chainId: target.chainId,
    solverId: target.solverId,
    query: { enabled: active && symbolId > 0 },
  });

  return (
    <MethodCard
      testId="method-getTradeVolume"
      name="getTradeVolume"
      mutability="view"
      description="Fetch the enigma solver's last N daily trade-volume rows for one market (day + notional traded). Enigma-only endpoint."
      wide
    >
      <SolverTargetSelect
        value={target}
        onChange={setTarget}
        requireKind="enigma"
        testId="select-trade-volume-solver"
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(140px,180px)_auto]">
        <Field label="symbolId" htmlFor="input-trade-volume-symbol-id">
          <Input
            id="input-trade-volume-symbol-id"
            type="number"
            min={1}
            value={symbolIdInput}
            onChange={(event) => setSymbolIdInput(event.target.value)}
            placeholder="1"
            inputMode="numeric"
            aria-invalid={symbolIdInput.length > 0 && symbolId === 0}
            data-testid="input-trade-volume-symbol-id"
          />
        </Field>

        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!active || symbolId === 0 || query.isFetching}
            onClick={() => void query.refetch()}
            data-testid="button-read-trade-volume"
          >
            {query.isFetching ? (
              <>
                <Spinner className="size-4" /> Refreshing…
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </div>

      {active ? null : (
        <ResultNote testId="result-getTradeVolume-inactive">
          Switch to the Enigma chain (HyperEVM) to call this endpoint.
        </ResultNote>
      )}

      <ResultPanel testId="result-getTradeVolume" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useTradeVolume> }) {
  const columns = useMemo<DataTableColumn<VolumeRow>[]>(() => buildColumns(), []);
  const buckets = useMemo(() => toVolumeBuckets(query.data), [query.data]);

  if (query.isLoading && query.isFetching) {
    return <TableSkeleton rows={4} columns={2} alignEndFrom={1} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Enter a market id to read its daily trade volume.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>The solver returned no trade volume.</ResultNote>;
  }

  return (
    <ChartWithTable
      chart={
        <BarChart
          series={VOLUME_SERIES}
          buckets={buckets}
          label="Daily trade volume"
          formatValue={formatChartUsd}
          formatX={formatChartDay}
          formatXDetail={formatChartDate}
          height={320}
          testId={`${testId}-chart`}
        />
      }
    >
      <DataTable
        testId={`${testId}-data`}
        columns={columns}
        data={query.data}
        totalCount={query.data.length}
        getRowId={(row) => String(row.timestamp)}
        initialSort={{ columnId: "timestamp", direction: "asc" }}
        defaultPageSize={7}
      />
    </ChartWithTable>
  );
}

/** Build the daily-volume table columns. */
function buildColumns(): DataTableColumn<VolumeRow>[] {
  return [
    {
      id: "timestamp",
      header: "Day",
      cell: (row) => formatDay(row.timestamp),
      sortAccessor: (row) => row.timestamp,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "volume",
      header: "Volume",
      align: "end",
      cell: (row) => row.volume,
      sortAccessor: (row) => Number(row.volume),
      cellClassName: "text-foreground font-mono",
    },
  ];
}

/**
 * Render an ISO 8601 day-bucket timestamp (e.g. `"2026-07-09T00:00:00Z"`) as a
 * readable UTC date. Falls back to the raw string if it does not parse.
 */
function formatDay(timestamp: string): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : DAY_FORMAT.format(date);
}
