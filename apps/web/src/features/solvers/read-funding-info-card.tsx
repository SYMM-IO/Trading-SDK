"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { MethodCard } from "@/features/inspector/method-card";
import { projectFundingRate } from "@symmio/trading-core";
import { useFundingInfo } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Input } from "@symmio/ui/components/input";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { formatPercentage } from "@symmio/utils";
import { useEffect, useMemo, useState } from "react";

/** One market's funding row, derived structurally from the hook's return type. */
type FundingRow = NonNullable<ReturnType<typeof useFundingInfo>["data"]>[number];

/** Conventional carry horizons (in days) offered as one-tap presets. */
const HORIZON_PRESETS = [
  { days: 1, label: "1D" },
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 365, label: "1Y" },
] as const;

/** Default projection window — a month of carry, where the projection earns its keep. */
const DEFAULT_HORIZON_DAYS = 30;

/** Short label for a day count, reusing a preset's name when one matches. */
function horizonLabel(days: number): string {
  return HORIZON_PRESETS.find((preset) => preset.days === days)?.label ?? `${days}D`;
}

/**
 * Solvers-page card for `/get_funding_info` — the next-epoch funding rate on
 * each side (Long = Pump, Short = Dump), the next funding time, and the epoch
 * length for every market the solver lists. A positive rate receives funding, a
 * negative rate pays. Fetched on demand via the Refresh button (no
 * auto-polling); the per-market table is searchable by symbol and carries a
 * projected-funding column for a user-chosen horizon.
 */
export function ReadFundingInfoCard() {
  const query = useFundingInfo();
  const [days, setDays] = useState<number>(DEFAULT_HORIZON_DAYS);

  return (
    <MethodCard
      testId="method-getFundingInfo"
      name="getFundingInfo"
      mutability="view"
      description="Fetch per-market funding rates (Long/Short), next funding time, and epoch length from the solver. Positive receives, negative pays."
      wide
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-funding-info"
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

      <div className="flex flex-col gap-1.5">
        <CarryHorizonControl days={days} onDaysChange={setDays} />
        <p className="text-muted-foreground text-xs">
          Projected funding = per-epoch rate × (period ÷ epoch). Linear, not compounded.
        </p>
      </div>

      <ResultPanel testId="result-getFundingInfo" query={query} days={days} />
    </MethodCard>
  );
}

/**
 * Carry-horizon selector: one-tap preset chips backed by an exact day input.
 * The presets are how funding carry is conventionally quoted (1D / 1W / 1M /
 * 1Y); the input keeps it precise. The two stay in sync — a preset lights up
 * when the day count matches it.
 */
function CarryHorizonControl({ days, onDaysChange }: { days: number; onDaysChange: (days: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="funding-horizon">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Carry horizon</span>

      <div
        role="group"
        aria-label="Projection horizon presets"
        className="border-border bg-input/40 inline-flex items-center gap-0.5 rounded-xl border p-0.5"
      >
        {HORIZON_PRESETS.map((preset) => {
          const active = preset.days === days;
          return (
            <button
              key={preset.days}
              type="button"
              aria-pressed={active}
              onClick={() => onDaysChange(preset.days)}
              data-testid={`funding-horizon-${preset.label}`}
              className={cn(
                "rounded-[10px] px-2.5 py-1 font-mono text-xs tabular-nums transition-colors",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Input
          type="number"
          min={1}
          value={days}
          onChange={(event) => {
            const parsed = Math.floor(Number(event.target.value));
            onDaysChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
          }}
          className="h-8 w-20 text-right font-mono tabular-nums"
          aria-label="Projection period in days"
          data-testid="funding-horizon-days"
        />
        days
      </label>
    </div>
  );
}

function ResultPanel({
  testId,
  query,
  days,
}: {
  testId: string;
  query: ReturnType<typeof useFundingInfo>;
  days: number;
}) {
  const [search, setSearch] = useState("");

  const rows = query.data;
  const visible = useMemo(() => {
    if (!rows) return [];
    const term = search.trim().toLowerCase();
    if (term.length === 0) return rows;
    return rows.filter((row) => row.symbol.toLowerCase().includes(term));
  }, [rows, search]);

  const columns = useMemo<DataTableColumn<FundingRow>[]>(() => buildColumns(days), [days]);

  if (query.isLoading && query.isFetching) {
    return <TableSkeleton rows={4} columns={6} alignEndFrom={1} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see solver funding rates.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>The solver returned no funding info.</ResultNote>;
  }

  return (
    <DataTable
      testId={`${testId}-data`}
      columns={columns}
      data={visible}
      totalCount={query.data.length}
      getRowId={(row) => row.symbol}
      initialSort={{ columnId: "symbol", direction: "asc" }}
      defaultPageSize={5}
      emptyMessage="No markets match this search."
      toolbar={
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search market…"
          containerClassName="flex-1"
          data-testid="funding-info-search"
          aria-label="Search markets"
        />
      }
    />
  );
}

/** Build the table columns for a given projection horizon. */
function buildColumns(days: number): DataTableColumn<FundingRow>[] {
  const projectedLong = (row: FundingRow) =>
    projectFundingRate({ ratePerEpoch: row.nextFundingRateLong, epochDurationSeconds: row.epochDurationSeconds, days });
  const projectedShort = (row: FundingRow) =>
    projectFundingRate({
      ratePerEpoch: row.nextFundingRateShort,
      epochDurationSeconds: row.epochDurationSeconds,
      days,
    });

  return [
    {
      id: "symbol",
      header: "Market",
      cell: (row) => row.symbol,
      sortAccessor: (row) => row.symbol,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "long",
      header: "Long (P)",
      align: "end",
      cell: (row) => <FundingRate rate={row.nextFundingRateLong} />,
      sortAccessor: (row) => row.nextFundingRateLong,
    },
    {
      id: "short",
      header: "Short (D)",
      align: "end",
      cell: (row) => <FundingRate rate={row.nextFundingRateShort} />,
      sortAccessor: (row) => row.nextFundingRateShort,
    },
    {
      id: "projected",
      header: `Proj · ${horizonLabel(days)} (P|D)`,
      align: "end",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <FundingRate rate={projectedLong(row)} decimals={2} />
          <span className="text-muted-foreground/50">|</span>
          <FundingRate rate={projectedShort(row)} decimals={2} />
        </span>
      ),
      sortAccessor: (row) => projectedLong(row),
    },
    {
      id: "next",
      header: "Next funding",
      align: "end",
      cell: (row) => <FundingCountdown timestamp={row.nextFundingTime} />,
      sortAccessor: (row) => row.nextFundingTime,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "epoch",
      header: "Epoch",
      align: "end",
      cell: (row) => formatEpochDuration(row.epochDurationSeconds),
      sortAccessor: (row) => row.epochDurationSeconds,
      cellClassName: "text-muted-foreground font-mono",
    },
  ];
}

/**
 * Render a funding rate as a signed percentage, tinted by direction: positive
 * (receives) in the positive tone, negative (pays) in the negative tone. The
 * rate is a decimal fraction, so scale by 100 for the percentage.
 */
function FundingRate({ rate, decimals = 4 }: { rate: number; decimals?: number }) {
  return (
    <span
      className={cn("font-mono", {
        "text-positive": rate > 0,
        "text-negative": rate < 0,
        "text-muted-foreground": rate === 0,
      })}
    >
      {formatPercentage(rate * 100, { withSign: true, fixedDecimals: decimals })}
    </span>
  );
}

/**
 * Live `HH:MM:SS` countdown to the next funding settlement. The solver reports
 * the timestamp in seconds or milliseconds, so normalize before diffing.
 */
function FundingCountdown({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (timestamp <= 0) return <>—</>;

  const targetMs = timestamp >= 1e12 ? timestamp : timestamp * 1000;
  const remainingMs = Math.max(0, targetMs - now);
  return <>{formatDuration(Math.floor(remainingMs / 1000))}</>;
}

/** Format a whole-second span as zero-padded `HH:MM:SS`. */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/** Format an epoch length in seconds as a compact `12h` / `1h 30m` / `45m` label. */
function formatEpochDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [hours && `${hours}h`, minutes && `${minutes}m`, seconds && `${seconds}s`].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "0s";
}
