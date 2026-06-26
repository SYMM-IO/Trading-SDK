"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { socketStatusLabel, socketStatusTone } from "@/features/websocket/socket-status-display";
import { useEnigmaPrices } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Input } from "@theoldvarorg/ui/components/input";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";

/**
 * Live price-service WebSocket card on the Price Service page. Toggle the
 * subscription via the button; once open, the table updates per tick with the
 * latest mark price by symbol name. A search input filters rows by symbol.
 */
export function WatchEnigmaPrices() {
  const [enabled, setEnabled] = useState(false);
  const [search, setSearch] = useState("");
  const { prices, status, error } = useEnigmaPrices({ enabled });

  const allRows = useMemo(() => {
    return Object.entries(prices)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, markPrice]) => ({ name, markPrice }));
  }, [prices]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return allRows;
    return allRows.filter((row) => row.name.toLowerCase().includes(query));
  }, [allRows, search]);

  return (
    <MethodCard
      testId="method-watchEnigmaPrices"
      name="watchEnigmaPrices"
      mutability="view"
      description="Subscribe to live mark-price ticks from the chain's configured Enigma price-service WebSocket."
      wide
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={() => setEnabled((prev) => !prev)}
          data-testid="button-watch-enigma-prices"
        >
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

      {enabled && allRows.length > 0 ? (
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search symbol…"
          data-testid="input-watch-enigma-prices-search"
          className="h-8 text-xs"
        />
      ) : null}

      <ResultPanel
        testId="result-watchEnigmaPrices"
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
  rows: { name: string; markPrice: string }[];
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
            <th className="px-3 py-2 text-right font-medium">Mark price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-border/40 border-t">
              <td className="text-foreground px-3 py-1.5 font-mono text-xs">{row.name}</td>
              <td className="text-foreground px-3 py-1.5 text-right font-mono text-xs">{row.markPrice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
