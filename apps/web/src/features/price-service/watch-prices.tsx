"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import type { MarkPriceTick } from "@symmio/trading-core";
import { usePrices } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "../solvers/solver-target";

/**
 * Provider-agnostic live price feed. Switching the solver target switches the
 * price source with no code change — Enigma · HyperEVM streams the lowcap price
 * service, Rasa · Base streams Binance USD-M Futures — which is the behaviour
 * this card exists to demonstrate.
 *
 * The `names` filter matters on Binance: that stream pushes every listed symbol
 * (~740) once per second, so leaving it empty is also a useful way to see the
 * difference in feed volume between the two providers.
 */
export function WatchPrices() {
  const { target, setTarget } = useSolverTargetState();
  const [enabled, setEnabled] = useState(false);
  const [namesInput, setNamesInput] = useState("");
  const [search, setSearch] = useState("");

  const names = useMemo(() => {
    const parsed = namesInput
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    return parsed.length > 0 ? parsed : undefined;
  }, [namesInput]);

  const { ticks, status, error } = usePrices({
    chainId: target.chainId,
    solverId: target.solverId,
    names,
    enabled,
  });

  const allRows = useMemo(() => Object.values(ticks).sort((a, b) => a.name.localeCompare(b.name)), [ticks]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return allRows;
    return allRows.filter((row) => row.name.toLowerCase().includes(query));
  }, [allRows, search]);

  return (
    <MethodCard
      testId="method-watchPrices"
      name="watchPrices"
      mutability="view"
      description="Subscribe to live mark-price ticks from whichever provider serves the selected solver — Enigma's lowcap service, or Binance USD-M Futures for majors."
      wide
    >
      <SolverTargetSelect value={target} onChange={setTarget} testId="select-watch-prices-solver" />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={() => setEnabled((prev) => !prev)} data-testid="button-watch-prices">
          {enabled ? "Stop" : "Start"}
        </Button>
        <span className="inline-flex items-center gap-2 text-xs">
          <StatusDot tone={socketStatusTone(status)} pulse={status === "open"} />
          {socketStatusLabel(status)}
        </span>
        {allRows.length > 0 ? (
          <span className="text-muted-foreground ml-auto text-xs">
            {rows.length === allRows.length
              ? `${allRows.length} symbol${allRows.length === 1 ? "" : "s"}`
              : `${rows.length} / ${allRows.length}`}
          </span>
        ) : null}
      </div>

      <Input
        value={namesInput}
        onChange={(event) => setNamesInput(event.target.value)}
        placeholder="Filter names, comma-separated (e.g. BTCUSDT, ETHUSDT) — empty streams every symbol"
        data-testid="input-watch-prices-names"
        className="h-8 text-xs"
      />

      {enabled && allRows.length > 0 ? (
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search symbol…"
          data-testid="input-watch-prices-search"
          className="h-8 text-xs"
        />
      ) : null}

      <ResultPanel
        testId="result-watchPrices"
        enabled={enabled}
        hasAny={allRows.length > 0}
        rows={rows}
        error={error?.message ?? null}
        errorKind={error?.kind ?? null}
        searching={search.trim().length > 0}
      />
    </MethodCard>
  );
}

interface ResultPanelProps {
  testId: string;
  enabled: boolean;
  hasAny: boolean;
  rows: MarkPriceTick[];
  error: string | null;
  errorKind: string | null;
  searching: boolean;
}

function ResultPanel({ testId, enabled, hasAny, rows, error, errorKind, searching }: ResultPanelProps) {
  if (error) return <ResultError testId={`${testId}-error`} kind={errorKind ?? undefined} message={error} />;
  if (!enabled) return <ResultNote testId={`${testId}-idle`}>Click Start to open the price WebSocket.</ResultNote>;
  if (!hasAny) {
    return (
      <ResultNote testId={`${testId}-waiting`} loading>
        Waiting for price ticks…
      </ResultNote>
    );
  }
  if (rows.length === 0 && searching) {
    return <ResultNote testId={`${testId}-no-match`}>No symbols match this search.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`} className="border-border bg-card/40 max-h-96 overflow-y-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-card/70 text-muted-foreground supports-[backdrop-filter]:bg-card/50 sticky top-0 text-xs backdrop-blur">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Symbol</th>
            <th className="px-3 py-2 text-left font-medium">Provider</th>
            <th className="px-3 py-2 text-right font-medium">Mark price</th>
            <th className="px-3 py-2 text-right font-medium">Index price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-border/40 border-t">
              <td className="text-foreground px-3 py-1.5 font-mono text-xs">{row.name}</td>
              <td className="text-muted-foreground px-3 py-1.5 font-mono text-xs">{row.provider}</td>
              <td className="text-foreground px-3 py-1.5 text-right font-mono text-xs">{row.markPrice}</td>
              {/* Narrowing on the discriminant is the whole point of the union — only Binance carries an index price. */}
              <td className="text-muted-foreground px-3 py-1.5 text-right font-mono text-xs">
                {row.provider === "binance" ? row.indexPrice : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
