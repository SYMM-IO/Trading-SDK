"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useBinanceSymbolsInfo } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "../solvers/solver-target";

/**
 * Binance's own contract listing. Reference data only — `getMarkets` remains the
 * authority on what is tradable on SYMMIO. The response is ~1 MB, so it is
 * fetched on demand and rendered as a filtered table rather than raw JSON.
 */
export function ReadBinanceSymbolsInfo() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const [search, setSearch] = useState("");
  const query = useBinanceSymbolsInfo({
    chainId: target.chainId,
    solverId: target.solverId,
    query: { enabled: false },
  });

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const term = search.trim().toLowerCase();
    const filtered = term.length === 0 ? all : all.filter((row) => row.symbol.toLowerCase().includes(term));
    return filtered.slice(0, 200);
  }, [query.data, search]);

  return (
    <MethodCard
      testId="method-getBinanceSymbolsInfo"
      name="getBinanceSymbolsInfo"
      mutability="view"
      description="Read Binance's contract listing — status and price/quantity precision per symbol. ~1 MB, cached for an hour."
      wide
    >
      <SolverTargetSelect
        value={target}
        onChange={setTarget}
        requireKind="rasa"
        testId="select-read-binance-symbols-info-solver"
      />

      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-binance-symbols-info"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read symbols info"
        )}
      </Button>

      {query.data ? (
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${query.data.length} symbols…`}
          data-testid="input-read-binance-symbols-info-search"
          className="h-8 text-xs"
        />
      ) : null}

      <ResultPanel testId="result-getBinanceSymbolsInfo" query={query} rows={rows} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  rows,
}: {
  testId: string;
  query: ReturnType<typeof useBinanceSymbolsInfo>;
  rows: NonNullable<ReturnType<typeof useBinanceSymbolsInfo>["data"]>;
}) {
  if (query.isFetching) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading ~1 MB listing...
      </ResultNote>
    );
  }
  if (query.error)
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  if (!query.data) return <ResultNote testId={`${testId}-idle`}>Read Binance&apos;s contract listing.</ResultNote>;
  if (rows.length === 0) return <ResultNote testId={`${testId}-no-match`}>No symbols match this search.</ResultNote>;

  return (
    <div data-testid={`${testId}-data`} className="border-border bg-card/40 max-h-96 overflow-y-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-card/70 text-muted-foreground supports-[backdrop-filter]:bg-card/50 sticky top-0 text-xs backdrop-blur">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Symbol</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Contract</th>
            <th className="px-3 py-2 text-right font-medium">Price prec.</th>
            <th className="px-3 py-2 text-right font-medium">Qty prec.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-border/40 border-t">
              <td className="text-foreground px-3 py-1.5 font-mono text-xs">{row.symbol}</td>
              <td className="text-muted-foreground px-3 py-1.5 font-mono text-xs">{row.status}</td>
              <td className="text-muted-foreground px-3 py-1.5 font-mono text-xs">{row.contractType}</td>
              <td className="text-muted-foreground px-3 py-1.5 text-right font-mono text-xs">{row.pricePrecision}</td>
              <td className="text-muted-foreground px-3 py-1.5 text-right font-mono text-xs">
                {row.quantityPrecision}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
