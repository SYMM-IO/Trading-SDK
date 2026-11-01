"use client";

import { ResultError, ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import type { TpSlRecord } from "@symmio/trading-react";
import { useEffect, useState } from "react";

// Reference-app waiting window, matching the SDK's internal confirming guard.
const CONFIRMATION_WINDOW_MS = 90_000;

interface Props {
  idPrefix: string;
  record?: TpSlRecord;
  tp: boolean;
  sl: boolean;
}

/** Mount for one accepted submission; only the submitted sides determine its result. */
export function TpSlConfirmationStatus({ idPrefix, record, tp, sl }: Props) {
  const [deadline] = useState(() => Date.now() + CONFIRMATION_WINDOW_MS);
  const [expired, setExpired] = useState(false);
  const sides = [tp ? record?.tpState : undefined, sl ? record?.slState : undefined];
  const active = (tp || sl) && (!tp || sides[0] === "new") && (!sl || sides[1] === "new");
  const failed = sides.some((state) => state === "canceled" || state === "killed");
  useEffect(() => {
    if (active || failed) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline, active, failed]);

  if (active) {
    return <ResultSuccess testId={`${idPrefix}-success`}>TP/SL active</ResultSuccess>;
  }
  // An expired store guard can fold an absent REST row to `canceled`. Absence
  // after the deadline is unconfirmed, not evidence that the write failed.
  if (expired || (!tp && !sl)) {
    return (
      <ResultWarning testId={`${idPrefix}-unconfirmed`}>TP/SL not confirmed yet — check current orders</ResultWarning>
    );
  }
  if (failed) {
    return (
      <ResultError
        testId={`${idPrefix}-error`}
        message="TP/SL activation failed for a submitted side. Check current orders before taking further action."
      />
    );
  }
  return (
    <ResultNote loading testId={`${idPrefix}-status`}>
      Setting TP/SL…
    </ResultNote>
  );
}
