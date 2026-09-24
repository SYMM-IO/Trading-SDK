"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useSolverInfo } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverKindActive, useSolverTargetState } from "./solver-target";

/**
 * Solvers-page card for `/info` — the enigma solver's static fee configuration
 * (USD per instant open / close, before signed fee-cap adjustments).
 * **Enigma-only**: the query is gated to the Enigma solver and stays idle on
 * other chains.
 */
export function EnigmaSolverInfoCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "enigma" });
  const active = useSolverKindActive("enigma");
  const query = useSolverInfo({
    chainId: target.chainId,
    solverId: target.solverId,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getSolverInfo"
      name="getSolverInfo"
      mutability="view"
      description="Static solver fee configuration (USD per instant open/close, before signed fee-cap adjustments). Enigma-only endpoint."
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="enigma" testId="select-solver-info-solver" />
      <Button
        type="button"
        size="sm"
        disabled={!active || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-solver-info"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>
      {active ? null : (
        <ResultNote testId="result-getSolverInfo-inactive">
          Switch to the Enigma chain (Arbitrum) to call this endpoint.
        </ResultNote>
      )}
      {query.error ? (
        <ResultError testId="result-getSolverInfo-error" kind={query.error.kind} message={query.error.message} />
      ) : query.data !== undefined ? (
        <dl className="grid gap-1 text-sm" data-testid="result-getSolverInfo">
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">staticSolverFeeOpen:</dt>
            <dd className="text-foreground font-mono">{query.data.staticSolverFeeOpen ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">staticSolverFeeClose:</dt>
            <dd className="text-foreground font-mono">{query.data.staticSolverFeeClose ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <ResultNote testId="result-getSolverInfo-idle">Read the solver&apos;s static fee configuration.</ResultNote>
      )}
    </MethodCard>
  );
}
