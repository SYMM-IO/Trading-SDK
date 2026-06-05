"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useLastWithdrawRequestId } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";

export function ReadLastWithdrawRequestId() {
  const [input, setInput] = useState<string>("");
  const validUser = isAddress(input) ? (input as Address) : undefined;

  const query = useLastWithdrawRequestId({ user: validUser });

  return (
    <MethodCard
      testId="method-getLastWithdrawRequestId"
      name="getLastWithdrawRequestId"
      mutability="view"
      description="Read a subaccount's most recent withdraw request id (0 when there are none)."
    >
      <Field label="user (subaccount address)" htmlFor="input-last-id-user">
        <Input
          id="input-last-id-user"
          data-testid="input-last-id-user"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={input.length > 0 && !validUser}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!validUser || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-last-id"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getLastWithdrawRequestId" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useLastWithdrawRequestId> }) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (query.data === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the last request id.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`}>
      <Stat label="Last request id" value={String(query.data)} />
    </div>
  );
}
