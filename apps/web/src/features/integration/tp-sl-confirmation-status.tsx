"use client";

import { ResultError, ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import type { TpSlSubmissionStatus } from "./use-tp-sl-submission-feedback";

/** Render the form's notification outcome, never infer completion from REST rows. */
export function TpSlConfirmationStatus({ idPrefix, status }: { idPrefix: string; status: TpSlSubmissionStatus }) {
  if (status === "active") return <ResultSuccess testId={`${idPrefix}-success`}>TP/SL active</ResultSuccess>;
  if (status === "triggered") {
    return (
      <ResultNote testId={`${idPrefix}-triggered`}>
        TP/SL confirmed; a trigger has fired. Check the position for execution status.
      </ResultNote>
    );
  }
  if (status === "failed") {
    return (
      <ResultError
        testId={`${idPrefix}-error`}
        message="TP/SL report indicates a failure or cancellation. Check current orders before taking further action."
      />
    );
  }
  if (status === "unconfirmed") {
    return (
      <ResultWarning testId={`${idPrefix}-unconfirmed`}>TP/SL not confirmed yet — check current orders</ResultWarning>
    );
  }
  return (
    <ResultNote loading testId={`${idPrefix}-status`}>
      Setting TP/SL…
    </ResultNote>
  );
}
