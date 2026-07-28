"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { useErrorMessage } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { JsonView } from "@symmio/ui/components/json-view";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

/** Rasa-only card: single error-code lookup (`/error_codes/{error_code}`). */
export function RasaErrorMessageCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const [code, setCode] = useState("2000");
  const parsed = Number(code);
  const validCode = Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;

  const query = useErrorMessage({
    chainId: target.chainId,
    solverId: target.solverId,
    errorCode: validCode ?? 0,
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-rasa-errorMessage"
      name="getErrorMessage"
      mutability="view"
      description="Resolve one numeric solver error code to its message. Rasa-only endpoint."
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-errmsg-solver" />
      <Field label="error code" htmlFor="input-rasa-errmsg-code">
        <Input
          id="input-rasa-errmsg-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          inputMode="numeric"
          aria-invalid={code.length > 0 && validCode === undefined}
          data-testid="input-rasa-errmsg-code"
        />
      </Field>
      <Button
        type="button"
        size="sm"
        disabled={validCode === undefined || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-rasa-error-message"
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
        <ResultError testId="result-rasa-errorMessage-error" kind={query.error.kind} message={query.error.message} />
      ) : query.data !== undefined ? (
        <JsonView data={query.data} data-testid="result-rasa-errorMessage" />
      ) : (
        <ResultNote testId="result-rasa-errorMessage-idle">Enter a code and read.</ResultNote>
      )}
    </MethodCard>
  );
}
