"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useVirtualAccountsCountOfSubAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

/**
 * Card for `getVirtualAccountsCountOfSubAccount`: how many Virtual Accounts a
 * subaccount holds — the number to page the VA lists by once it passes their
 * default limit of 200.
 */
export function ReadGetVirtualAccountsCountOfSubAccount() {
  const [input, setInput] = useState<string>("");
  const validSubAccount = isAddress(input) ? input : undefined;

  const query = useVirtualAccountsCountOfSubAccount({ subAccount: validSubAccount, query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getVirtualAccountsCountOfSubAccount"
      name="getVirtualAccountsCountOfSubAccount"
      mutability="view"
      description="Count a subaccount's Virtual Accounts (VAs) — what to page the VA lists by past their default 200."
    >
      <SubAccountField
        idPrefix="va-count-subaccount"
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
        data-testid="button-read-va-count"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getVirtualAccountsCountOfSubAccount" query={query} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
}: {
  testId: string;
  query: ReturnType<typeof useVirtualAccountsCountOfSubAccount>;
}) {
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
    return <ResultNote testId={`${testId}-idle`}>Enter a subaccount address and read.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`}>
      <Stat label="Virtual accounts" value={query.data.toString()} />
    </div>
  );
}
