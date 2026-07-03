"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { formatUsd } from "@/lib/format";
import { useAccountBalanceOf } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountPicker } from "./subaccount-picker";

interface Selection {
  subAccount?: Address;
  name?: string;
}

export function ReadAccountBalanceOf() {
  const [selection, setSelection] = useState<Selection>({});
  const query = useAccountBalanceOf({
    account: selection.subAccount,
  });

  return (
    <MethodCard
      testId="method-getAccountBalanceOf"
      name="getAccountBalanceOf"
      mutability="view"
      description="Read balanceOf for a selected subaccount on its SYMMIO core."
      wide
    >
      <SubAccountPicker idPrefix="input-balance-of" selected={selection} onSelect={setSelection} />

      <Button
        type="button"
        size="sm"
        disabled={!selection.subAccount || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-subaccount-balance-of"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read balanceOf"
        )}
      </Button>

      <ResultPanel testId="result-getAccountBalanceOf" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useAccountBalanceOf> }) {
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
    return <ResultNote testId={`${testId}-idle`}>Select a subaccount to read balanceOf.</ResultNote>;
  }

  return (
    <div data-testid={`${testId}-data`}>
      <Stat label="Subaccount balanceOf" value={formatUsd(query.data)} hint={`${String(query.data)} raw units`} />
    </div>
  );
}
