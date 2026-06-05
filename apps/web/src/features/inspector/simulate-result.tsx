"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import type { SymmioRequestError } from "@symm-frontier/react";
import type { ReactNode } from "react";

interface Props {
  /** `true` while the dry-run `simulateContract` call is in flight. */
  isPending: boolean;
  /** `true` once the dry-run returned without reverting. */
  isSuccess: boolean;
  /** Normalized failure (e.g. a decoded `contract-revert`), or `null`. */
  error: SymmioRequestError | null;
  /** Prefix for the rendered result test ids (`{testId}-pending` / `-error` / `-success`). */
  testId: string;
  /** Decoded return value shown under the "passed" message (e.g. predicted addresses). */
  children?: ReactNode;
}

/**
 * Outcome panel for a write-method dry-run (`simulateContract`): a loading note
 * while the call is in flight, the decoded revert reason on failure, or a
 * "simulation passed" panel — with an optional decoded return value — on success.
 * Renders nothing while idle so it sits quietly above the Send result panel.
 */
export function SimulateResult({ isPending, isSuccess, error, testId, children }: Props) {
  if (isPending) {
    return (
      <ResultNote testId={`${testId}-pending`} loading>
        Simulating… running a dry-run against the chain.
      </ResultNote>
    );
  }
  if (error) {
    return <ResultError testId={`${testId}-error`} kind={error.kind} message={error.message} />;
  }
  if (isSuccess) {
    return (
      <ResultSuccess testId={`${testId}-success`}>
        <span className="text-foreground">Simulation passed — the transaction should succeed if sent now.</span>
        {children}
      </ResultSuccess>
    );
  }
  return null;
}
