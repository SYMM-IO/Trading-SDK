"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { useSolverOpenInterest } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

/** Rasa-only card: solver-wide open interest (`/open-interest`). */
export function RasaOpenInterestCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const query = useSolverOpenInterest({
    chainId: target.chainId,
    solverId: target.solverId,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-rasa-openInterest"
      name="getSolverOpenInterest"
      mutability="view"
      description="Solver-wide open interest: total cap and current usage. Rasa-only endpoint."
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-oi-solver" />
      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-rasa-open-interest"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read"
        )}
      </Button>
      {query.error ? (
        <ResultError testId="result-rasa-openInterest-error" kind={query.error.kind} message={query.error.message} />
      ) : query.data !== undefined ? (
        <DataList data-testid="result-rasa-openInterest">
          <DataRow label="total_cap" value={<span className="font-mono">{query.data.total_cap}</span>} />
          <DataRow label="used" value={<span className="font-mono">{query.data.used}</span>} />
        </DataList>
      ) : (
        <ResultNote testId="result-rasa-openInterest-idle">Read to fetch the solver-wide totals.</ResultNote>
      )}
    </MethodCard>
  );
}
