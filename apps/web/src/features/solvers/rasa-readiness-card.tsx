"use client";

import { BoolBadge } from "@/components/bool-badge";
import { ResultError, ResultNote } from "@/components/result";
import { useSolverReadiness } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

/** Rasa-only card: solver availability check (`/readyz`). */
export function RasaReadinessCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const query = useSolverReadiness({
    chainId: target.chainId,
    solverId: target.solverId,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-rasa-readiness"
      name="getSolverReadiness"
      mutability="view"
      description="Solver availability check. Rasa-only endpoint."
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-ready-solver" />
      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-rasa-readiness"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Checking...
          </>
        ) : (
          "Check"
        )}
      </Button>
      {query.error ? (
        <ResultError testId="result-rasa-readiness-error" kind={query.error.kind} message={query.error.message} />
      ) : query.data !== undefined ? (
        <div className="flex items-center gap-2 text-sm" data-testid="result-rasa-readiness">
          <span className="text-muted-foreground">isReady:</span> <BoolBadge value={query.data.isReady} />
        </div>
      ) : (
        <ResultNote testId="result-rasa-readiness-idle">Check the solver&apos;s availability.</ResultNote>
      )}
    </MethodCard>
  );
}
