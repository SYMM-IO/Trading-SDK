"use client";

import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { DataRowsSkeleton } from "@/components/skeletons";
import { formatUsd } from "@/lib/format";
import { useAccountBalanceInfo } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountPicker } from "./subaccount-picker";

const BALANCE_FIELDS = [
  ["allocatedBalance", "allocatedBalance"],
  ["lockedCVA", "lockedCVA"],
  ["lockedLF", "lockedLF"],
  ["lockedPartyAMM", "lockedPartyAMM"],
  ["lockedPartyBMM", "lockedPartyBMM"],
  ["pendingLockedCVA", "pendingLockedCVA"],
  ["pendingLockedLF", "pendingLockedLF"],
  ["pendingLockedPartyAMM", "pendingLockedPartyAMM"],
  ["pendingLockedPartyBMM", "pendingLockedPartyBMM"],
] as const;

interface Selection {
  subAccount?: Address;
  name?: string;
}

export function ReadAccountBalanceInfo() {
  const [selection, setSelection] = useState<Selection>({});
  const query = useAccountBalanceInfo({ account: selection.subAccount });

  return (
    <MethodCard
      testId="method-getAccountBalanceInfo"
      name="getAccountBalanceInfo"
      magicMethodId="account-balance-info"
      magicMethodInput={selection.subAccount}
      mutability="view"
      description="Read balanceInfoOfPartyA for a selected subaccount on its SYMMIO core."
      wide
    >
      <SubAccountPicker idPrefix="input-balance-info" selected={selection} onSelect={setSelection} />

      <Button
        type="button"
        size="sm"
        disabled={!selection.subAccount || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-subaccount-balance-info"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read balance info"
        )}
      </Button>

      <ResultPanel testId="result-getAccountBalanceInfo" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useAccountBalanceInfo> }) {
  if (query.isLoading) {
    return <DataRowsSkeleton rows={9} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Select a subaccount to read balance info.</ResultNote>;
  }

  return (
    <DataList data-testid={`${testId}-data`}>
      {BALANCE_FIELDS.map(([key, label]) => {
        const raw = query.data[key];
        return (
          <DataRow
            key={key}
            label={label}
            value={formatUsd(raw)}
            mono
            copyValue={raw.toString()}
            className="items-start"
          />
        );
      })}
    </DataList>
  );
}
