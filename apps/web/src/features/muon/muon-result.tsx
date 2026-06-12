"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";

interface Props {
  testId: string;
  /**
   * Any Muon mutation: its `data` is a normalized attestation object (rendered
   * field-by-field), and `error` carries the SDK error `kind` + message.
   */
  mutation: { data?: unknown; error: { kind: string; message: string } | null };
  /** Message shown before the first fetch. */
  idleHint?: string;
}

/**
 * Generic renderer for a normalized Muon attestation: every returned field as a
 * label/value row, with bigints and arrays stringified. Shared by all Muon cards
 * so each method's result displays consistently without a bespoke layout.
 */
export function MuonResultPanel({ testId, mutation, idleHint = "Fill the form and fetch." }: Props) {
  if (mutation.error) {
    return <ResultError testId={`${testId}-error`} kind={mutation.error.kind} message={mutation.error.message} />;
  }
  const data = mutation.data as Record<string, unknown> | undefined;
  if (!data) {
    return <ResultNote testId={`${testId}-idle`}>{idleHint}</ResultNote>;
  }

  const entries = Object.entries(data);
  return (
    <DataList data-testid={`${testId}-data`}>
      {entries.map(([key, value]) => {
        const display = formatMuonValue(value);
        return <DataRow key={key} label={key} value={display} mono copyValue={display} className="items-start" />;
      })}
    </DataList>
  );
}

/** Stringify a normalized Muon field (bigint, array, address/hex, object) for display. */
export function formatMuonValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `[${value.map((item) => formatMuonValue(item)).join(", ")}]`;
  }
  if (typeof value === "object")
    return JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? val.toString() : val));
  return String(value);
}
