"use client";

import { ResultError, ResultNote } from "@/components/result";
import { StatusDot } from "@/components/status-dot";
import { useBinanceHealth } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "../solvers/solver-target";

/**
 * Binance liveness probe. Answers `false` rather than erroring when the endpoint
 * is unreachable, which is how you tell a regional block or dead proxy apart
 * from "this market has no price".
 */
export function ReadBinanceHealth() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const query = useBinanceHealth({
    chainId: target.chainId,
    solverId: target.solverId,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getBinanceHealth"
      name="getBinanceHealth"
      mutability="view"
      description="Probe whether Binance USD-M Futures is reachable from this client."
      wide
    >
      <SolverTargetSelect
        value={target}
        onChange={setTarget}
        requireKind="rasa"
        testId="select-read-binance-health-solver"
      />

      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-binance-health"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Probing...
          </>
        ) : (
          "Probe Binance"
        )}
      </Button>

      <ResultPanel testId="result-getBinanceHealth" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useBinanceHealth> }) {
  if (query.isFetching) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Probing...
      </ResultNote>
    );
  }
  if (query.error)
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  if (query.data === undefined) return <ResultNote testId={`${testId}-idle`}>Probe the Binance endpoint.</ResultNote>;

  return (
    <div data-testid={`${testId}-data`} className="flex items-center gap-2 text-sm">
      <StatusDot tone={query.data ? "positive" : "negative"} />
      <span className="text-foreground font-mono text-xs">
        {query.data ? "reachable" : "unreachable — blocked, proxied, or offline"}
      </span>
    </div>
  );
}
