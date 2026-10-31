"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useDeallocateDebounceTime } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { MethodCard } from "./method-card";

/**
 * Inspector card for `getDeallocateDebounceTime`: the protocol's minimum gap
 * between two deallocations of one account. A deployment-wide setting, so the
 * card has no input; it reads only on **Read**.
 */
export function ReadDeallocateDebounceTime() {
  const query = useDeallocateDebounceTime({ query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getDeallocateDebounceTime"
      name="getDeallocateDebounceTime"
      mutability="view"
      description="Read the minimum time the protocol enforces between two deallocations of the same account."
    >
      <Button
        type="button"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-deallocate-debounce-time"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getDeallocateDebounceTime" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useDeallocateDebounceTime> }) {
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (query.isFetching && query.data === undefined) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading…
      </ResultNote>
    );
  }
  if (query.data === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the deallocate debounce.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`}>
      <Stat
        label="Deallocate debounce"
        value={formatSeconds(query.data)}
        hint={
          query.data === 0n
            ? "No gap: deallocations are not spaced."
            : `${String(query.data)} seconds after an account's cooldown stamp before it can deallocate again.`
        }
      />
    </div>
  );
}

/** Format a whole-second span as a compact `1h 30m` / `45s` label; `0` reads `None`. */
function formatSeconds(total: bigint): string {
  if (total === 0n) return "None";
  const seconds = Number(total);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours && `${hours}h`, minutes && `${minutes}m`, rest && `${rest}s`].filter(Boolean).join(" ");
}
