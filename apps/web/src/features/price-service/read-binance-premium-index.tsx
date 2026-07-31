"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useBinancePremiumIndex } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "../solvers/solver-target";
import { JsonResult } from "./json-result";

/**
 * Binance `premiumIndex` read. Exactly one name takes the cheap single-symbol
 * request form (weight 1); several or none take the all-symbols form (weight 10).
 */
export function ReadBinancePremiumIndex() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const [namesInput, setNamesInput] = useState("BTCUSDT");

  const names = useMemo(() => {
    const parsed = namesInput
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    return parsed.length > 0 ? parsed : undefined;
  }, [namesInput]);

  const query = useBinancePremiumIndex({
    chainId: target.chainId,
    solverId: target.solverId,
    names,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getBinancePremiumIndex"
      name="getBinancePremiumIndex"
      mutability="view"
      description="Read Binance mark price, index price and Binance's own funding fields."
      wide
    >
      <SolverTargetSelect
        value={target}
        onChange={setTarget}
        requireKind="rasa"
        testId="select-read-binance-premium-index-solver"
      />

      <Input
        value={namesInput}
        onChange={(event) => setNamesInput(event.target.value)}
        placeholder="Market names, comma-separated — empty reads every listed symbol"
        data-testid="input-read-binance-premium-index-names"
        className="h-8 text-xs"
      />

      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-binance-premium-index"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read premium index"
        )}
      </Button>

      <ResultPanel testId="result-getBinancePremiumIndex" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useBinancePremiumIndex> }) {
  if (query.isFetching) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading...
      </ResultNote>
    );
  }
  if (query.error)
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  if (!query.data) return <ResultNote testId={`${testId}-idle`}>Read the Binance premium index.</ResultNote>;
  if (query.data.length === 0)
    return <ResultNote testId={`${testId}-empty`}>No prices returned for those names.</ResultNote>;
  return <JsonResult testId={`${testId}-data`} value={query.data} />;
}
