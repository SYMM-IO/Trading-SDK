"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { socketStatusLabel, socketStatusTone } from "@/features/notifications/socket-status-display";
import type { BinanceMarkPriceTick } from "@symmio/trading-core";
import { useBinancePrices } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "../solvers/solver-target";

/**
 * Binance-specific live feed. Unlike the provider-agnostic `watchPrices` card,
 * every tick here is typed as a Binance tick, so `indexPrice` and the Binance
 * funding fields are reachable without narrowing on `provider`.
 */
export function WatchBinancePrices() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const [enabled, setEnabled] = useState(false);
  const [namesInput, setNamesInput] = useState("BTCUSDT, ETHUSDT");

  const names = useMemo(() => {
    const parsed = namesInput
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    return parsed.length > 0 ? parsed : undefined;
  }, [namesInput]);

  const { ticks, status, error } = useBinancePrices({
    chainId: target.chainId,
    solverId: target.solverId,
    names,
    enabled,
  });

  const rows = useMemo(() => Object.values(ticks).sort((a, b) => a.name.localeCompare(b.name)), [ticks]);

  return (
    <MethodCard
      testId="method-watchBinancePrices"
      name="watchBinancePrices"
      mutability="view"
      description="Subscribe to Binance USD-M Futures' all-market mark-price stream. Every tick carries index price and Binance's own funding fields."
      wide
    >
      <SolverTargetSelect
        value={target}
        onChange={setTarget}
        requireKind="rasa"
        testId="select-watch-binance-prices-solver"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={() => setEnabled((prev) => !prev)}
          data-testid="button-watch-binance-prices"
        >
          {enabled ? "Stop" : "Start"}
        </Button>
        <span className="inline-flex items-center gap-2 text-xs">
          <StatusDot tone={socketStatusTone(status)} pulse={status === "open"} />
          {socketStatusLabel(status)}
        </span>
        {rows.length > 0 ? (
          <span className="text-muted-foreground ml-auto text-xs">
            {rows.length} symbol{rows.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <Input
        value={namesInput}
        onChange={(event) => setNamesInput(event.target.value)}
        placeholder="Filter names, comma-separated — empty streams every listed symbol (~740/sec)"
        data-testid="input-watch-binance-prices-names"
        className="h-8 text-xs"
      />

      <ResultPanel
        testId="result-watchBinancePrices"
        enabled={enabled}
        rows={rows}
        error={error?.message ?? null}
        errorKind={error?.kind ?? null}
      />
    </MethodCard>
  );
}

interface ResultPanelProps {
  testId: string;
  enabled: boolean;
  rows: BinanceMarkPriceTick[];
  error: string | null;
  errorKind: string | null;
}

function ResultPanel({ testId, enabled, rows, error, errorKind }: ResultPanelProps) {
  if (error) return <ResultError testId={`${testId}-error`} kind={errorKind ?? undefined} message={error} />;
  if (!enabled) return <ResultNote testId={`${testId}-idle`}>Click Start to open the Binance stream.</ResultNote>;
  if (rows.length === 0) {
    return (
      <ResultNote testId={`${testId}-waiting`} loading>
        Waiting for price ticks…
      </ResultNote>
    );
  }
  return (
    <div data-testid={`${testId}-data`} className="border-border bg-card/40 max-h-96 overflow-y-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-card/70 text-muted-foreground supports-[backdrop-filter]:bg-card/50 sticky top-0 text-xs backdrop-blur">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Symbol</th>
            <th className="px-3 py-2 text-right font-medium">Mark</th>
            <th className="px-3 py-2 text-right font-medium">Index</th>
            <th className="px-3 py-2 text-right font-medium">Binance funding</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-border/40 border-t">
              <td className="text-foreground px-3 py-1.5 font-mono text-xs">{row.name}</td>
              <td className="text-foreground px-3 py-1.5 text-right font-mono text-xs">{row.markPrice}</td>
              <td className="text-muted-foreground px-3 py-1.5 text-right font-mono text-xs">{row.indexPrice}</td>
              <td className="text-muted-foreground px-3 py-1.5 text-right font-mono text-xs">
                {row.binanceLastFundingRate}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
