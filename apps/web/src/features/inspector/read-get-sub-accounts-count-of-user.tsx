"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useSubAccountsCountOfUser, useWalletAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";

export function ReadGetSubAccountsCountOfUser() {
  const { address } = useWalletAccount();
  const [input, setInput] = useState<string>("");

  const candidate = (input || address || "") as string;
  const validAddress = isAddress(candidate) ? (candidate as Address) : undefined;

  const query = useSubAccountsCountOfUser({ user: validAddress });

  return (
    <MethodCard
      testId="method-getSubAccountsCountOfUser"
      name="getSubAccountsCountOfUser"
      mutability="view"
      description="Count how many subaccounts an address owns."
    >
      <Field label="user (address)" htmlFor="input-count-user-address">
        <Input
          id="input-count-user-address"
          data-testid="input-count-user-address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={address ?? "0x…"}
          className="font-mono"
          aria-invalid={candidate.length > 0 && !validAddress}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!validAddress || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-count"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getSubAccountsCountOfUser" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useSubAccountsCountOfUser> }) {
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
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the count.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`}>
      <Stat label="Subaccounts" value={String(query.data)} />
    </div>
  );
}
