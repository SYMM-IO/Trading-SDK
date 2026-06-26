"use client";

import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { useSolverErrorCodes, useSolverErrorMessage } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Input } from "@theoldvarorg/ui/components/input";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";

/** Parse the lookup input into a non-negative integer error code, or `undefined`. */
function parseErrorCode(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Solver error-codes card. Fetches the chain solver's `/error_codes` map via
 * {@link useSolverErrorCodes} and resolves a single typed code to its message via
 * {@link useSolverErrorMessage} — the path that turns the numeric `errorCode` on a
 * failed close/open notification into something human-readable.
 */
export function SolverErrorCodesCard() {
  const codesQuery = useSolverErrorCodes();
  const [codeInput, setCodeInput] = useState("2000");
  const validCode = parseErrorCode(codeInput);
  const message = useSolverErrorMessage(validCode);
  const count = codesQuery.data ? Object.keys(codesQuery.data).length : 0;

  return (
    <MethodCard
      testId="method-getSolverErrorCodes"
      name="getSolverErrorCodes"
      mutability="view"
      description="Fetch the solver's error-code → message map and resolve the errorCode from a failed close/open notification to its message."
      wide
    >
      <Field
        label="error code"
        htmlFor="input-solver-error-code"
        hint="The numeric error_code from a failed notification (e.g. 2000)."
      >
        <Input
          id="input-solver-error-code"
          value={codeInput}
          onChange={(event) => setCodeInput(event.target.value)}
          placeholder="2000"
          inputMode="numeric"
          aria-invalid={codeInput.length > 0 && validCode === undefined}
          data-testid="input-solver-error-code"
        />
      </Field>

      <LookupPanel testId="result-resolveErrorCode" code={validCode} message={message} query={codesQuery} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={codesQuery.isFetching}
          onClick={() => void codesQuery.refetch()}
          data-testid="button-refresh-error-codes"
        >
          {codesQuery.isFetching ? (
            <>
              <Spinner className="size-4" /> Fetching…
            </>
          ) : codesQuery.data ? (
            "Refresh map"
          ) : (
            "Fetch map"
          )}
        </Button>
        {codesQuery.data ? (
          <span className="text-muted-foreground font-mono text-xs">
            {count} code{count === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <CodesPanel testId="result-getSolverErrorCodes" query={codesQuery} />
    </MethodCard>
  );
}

/** The single-code lookup result, resolved against the cached error-code map. */
function LookupPanel({
  testId,
  code,
  message,
  query,
}: {
  testId: string;
  code: number | undefined;
  message: string | undefined;
  query: ReturnType<typeof useSolverErrorCodes>;
}) {
  if (code === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Enter a numeric error code to resolve its message.</ResultNote>;
  }
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading error codes…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (message === undefined) {
    return <ResultNote testId={`${testId}-empty`}>The solver registers no message for code {code}.</ResultNote>;
  }
  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="code" value={code} mono />
      <DataRow label="message" value={message} copyValue={message} />
    </DataList>
  );
}

/** The full error-code → message map, for reference. */
function CodesPanel({ testId, query }: { testId: string; query: ReturnType<typeof useSolverErrorCodes> }) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading error codes…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  const entries: [string, string][] = query.data ? Object.entries(query.data) : [];
  if (entries.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>The solver returned no error codes.</ResultNote>;
  }
  return (
    <div className="border-border max-h-72 overflow-y-auto rounded-xl border px-3" data-testid={`${testId}-data`}>
      <DataList>
        {entries.map(([code, message]) => (
          <DataRow key={code} label={`#${code}`} value={message} copyValue={message} />
        ))}
      </DataList>
    </div>
  );
}
