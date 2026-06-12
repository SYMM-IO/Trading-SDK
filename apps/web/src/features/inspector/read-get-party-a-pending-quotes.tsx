"use client";

import { ResultError, ResultNote } from "@/components/result";
import { ListSkeleton } from "@/components/skeletons";
import { usePartyAPendingQuotes } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { PartyAField } from "./party-a-field";

export function ReadGetPartyAPendingQuotes() {
  const [input, setInput] = useState<string>("");
  const validPartyA = isAddress(input) ? (input as Address) : undefined;

  const query = usePartyAPendingQuotes({ partyA: validPartyA });

  return (
    <MethodCard
      testId="method-getPartyAPendingQuotes"
      name="getPartyAPendingQuotes"
      mutability="view"
      description="List a partyA's pending quote ids (PENDING / LOCKED / CANCEL_PENDING). Hydrate each with getQuote."
      wide
    >
      <PartyAField
        idPrefix="pending-quotes-partya"
        label="partyA (subaccount or VA address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validPartyA}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validPartyA || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-pending-quotes"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getPartyAPendingQuotes" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof usePartyAPendingQuotes> }) {
  if (query.isLoading) {
    return <ListSkeleton rows={3} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see pending quote ids.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No pending quotes for this partyA.</ResultNote>;
  }
  return (
    <ul data-testid={`${testId}-data`} className="flex flex-wrap gap-1.5">
      {query.data.map((quoteId) => (
        <li
          key={String(quoteId)}
          data-quote-id={String(quoteId)}
          className="border-border/60 bg-muted/30 text-foreground rounded-lg border px-3 py-1.5 font-mono text-sm"
        >
          #{String(quoteId)}
        </li>
      ))}
    </ul>
  );
}
