"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useLastWithdrawRequestId } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

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
      <SubAccountField
        idPrefix="lastid-user"
        label="user (subaccount address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validUser}
      />

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
