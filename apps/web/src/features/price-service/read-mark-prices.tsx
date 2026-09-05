"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useMarkPrices } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "../solvers/solver-target";
import { JsonResult } from "./json-result";

/**
 * One-shot mark-price snapshot from whichever provider serves the selected
 * solver. Useful for a first paint before the socket connects, and it is the
 * same read `resolveMarkPrice` performs on the trade path.
 *
 * On Binance, passing exactly one name takes the single-symbol request form
 * (weight 1) rather than the all-symbols form (weight 10).
 */
export function ReadMarkPrices() {
  const { target, setTarget } = useSolverTargetState();
  const [namesInput, setNamesInput] = useState("BTCUSDT");

  const names = useMemo(() => {
    const parsed = namesInput
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    return parsed.length > 0 ? parsed : undefined;
  }, [namesInput]);

  const query = useMarkPrices({
    chainId: target.chainId,
    solverId: target.solverId,
    names,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getMarkPrices"
      name="getMarkPrices"
      mutability="view"
      description="Read a one-shot mark-price snapshot from whichever provider serves the selected solver."
      wide
    >
      <SolverTargetSelect value={target} onChange={setTarget} testId="select-read-mark-prices-solver" />

      <Input
        value={namesInput}
        onChange={(event) => setNamesInput(event.target.value)}
        placeholder="Market names, comma-separated — empty reads every symbol the provider serves"
        data-testid="input-read-mark-prices-names"
        className="h-8 text-xs"
      />

      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-mark-prices"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read mark prices"
        )}
      </Button>

      <ResultPanel testId="result-getMarkPrices" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useMarkPrices> }) {
  if (query.isFetching) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading...
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Pick a solver and read mark prices.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No prices returned for those names.</ResultNote>;
  }

  return <JsonResult testId={`${testId}-data`} value={query.data} />;
}
