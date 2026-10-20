"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { formatRemaining, useCountdown } from "@/lib/use-countdown";
import { useWithdrawableTime } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

export function ReadWithdrawableTime() {
  const [input, setInput] = useState<string>("");
  const validUser = isAddress(input) ? (input as Address) : undefined;

  const query = useWithdrawableTime({ user: validUser });

  return (
    <MethodCard
      testId="method-getWithdrawableTime"
      name="getWithdrawableTime"
      mutability="view"
      description="Read the earliest time a withdrawal initiated now could be finalized for a subaccount."
    >
      <SubAccountField
        idPrefix="withdrawable-user"
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
        data-testid="button-read-withdrawable-time"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getWithdrawableTime" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useWithdrawableTime> }) {
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
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the withdrawable time.</ResultNote>;
  }
  return <WithdrawableResult testId={testId} seconds={query.data} />;
}

/**
 * The finalizable timestamp plus a live cooldown countdown to it. Split out of
 * {@link ResultPanel} so the ticking hook is not called behind its early returns.
 */
function WithdrawableResult({ testId, seconds }: { testId: string; seconds: bigint }) {
  const when = new Date(Number(seconds) * 1000);
  const { remainingMs, ready } = useCountdown(when.getTime());
  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-4">
      <Stat label="Withdrawable at" value={when.toLocaleString()} hint={`Unix ${String(seconds)}`} />
      <Stat
        size="sm"
        label="Cooldown"
        value={ready ? "Elapsed" : `${formatRemaining(remainingMs)} left`}
        tone={ready ? "positive" : "neutral"}
        hint={ready ? "A withdrawal initiated now can finalize immediately." : undefined}
        testId={`${testId}-cooldown`}
      />
    </div>
  );
}
