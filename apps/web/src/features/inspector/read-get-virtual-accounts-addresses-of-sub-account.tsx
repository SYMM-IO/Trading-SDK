"use client";

import { AddressTag } from "@/components/address-tag";
import { ResultError, ResultNote } from "@/components/result";
import { ListSkeleton } from "@/components/skeletons";
import { useVirtualAccountsAddressesOfSubAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

export function ReadGetVirtualAccountsAddressesOfSubAccount() {
  const [input, setInput] = useState<string>("");
  const validSubAccount = isAddress(input) ? (input as Address) : undefined;

  const query = useVirtualAccountsAddressesOfSubAccount({ subAccount: validSubAccount });

  return (
    <MethodCard
      testId="method-getVirtualAccountsAddressesOfSubAccount"
      name="getVirtualAccountsAddressesOfSubAccount"
      mutability="view"
      description="List a subaccount's Virtual Account (VA) addresses — the partyA values for VibeCaps quote reads."
      wide
    >
      <SubAccountField
        idPrefix="va-addresses-subaccount"
        label="subAccount (subaccount address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validSubAccount}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validSubAccount || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-va-addresses"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getVirtualAccountsAddressesOfSubAccount" query={query} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
}: {
  testId: string;
  query: ReturnType<typeof useVirtualAccountsAddressesOfSubAccount>;
}) {
  if (query.isLoading) {
    return <ListSkeleton rows={4} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see VA addresses.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No virtual accounts for this subaccount.</ResultNote>;
  }
  return (
    <ul data-testid={`${testId}-data`} className="flex flex-col gap-1.5">
      {query.data.map((addr) => (
        <li
          key={addr}
          className="border-border/60 bg-muted/30 flex items-center justify-between rounded-lg border px-3 py-2"
        >
          <AddressTag address={addr} chars={6} />
        </li>
      ))}
    </ul>
  );
}
