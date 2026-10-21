"use client";

import { ResultError, ResultNote, ResultSuccess, ResultWarning } from "@/components/result";
import { ListSkeleton } from "@/components/skeletons";
import { useIsPartyALiquidated } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { PartyAField } from "./party-a-field";

export function ReadIsPartyALiquidated() {
  const [input, setInput] = useState<string>("");
  const validPartyA = isAddress(input) ? (input as Address) : undefined;

  const query = useIsPartyALiquidated({ partyA: validPartyA, query: { enabled: false } });

  return (
    <MethodCard
      testId="method-isPartyALiquidated"
      name="isPartyALiquidated"
      mutability="view"
      description="Whether a partyA's liquidation is in progress — true from the moment a liquidator starts it until it is finalized."
    >
      <PartyAField
        idPrefix="is-liquidated-partya"
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
        data-testid="button-read-is-party-a-liquidated"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-isPartyALiquidated" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useIsPartyALiquidated> }) {
  if (query.isLoading) {
    return <ListSkeleton rows={1} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (query.data === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the liquidation flag.</ResultNote>;
  }
  if (query.data) {
    return (
      <ResultWarning testId={`${testId}-liquidated`}>
        In liquidation — the account is frozen and every action on its positions reverts until the liquidation is
        finalized.
      </ResultWarning>
    );
  }
  return <ResultSuccess testId={`${testId}-not-liquidated`}>Not in liquidation.</ResultSuccess>;
}
