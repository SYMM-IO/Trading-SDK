"use client";

import { AddressTag } from "@/components/address-tag";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { ListSkeleton } from "@/components/skeletons";
import { useUserSubAccountsAddresses, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";

export function ReadGetUserSubAccountsAddresses() {
  const { address } = useWalletAccount();
  const [input, setInput] = useState<string>("");

  const candidate = (input || address || "") as string;
  const validAddress = isAddress(candidate) ? (candidate as Address) : undefined;

  const query = useUserSubAccountsAddresses({ user: validAddress });

  return (
    <MethodCard
      testId="method-getUserSubAccountsAddresses"
      name="getUserSubAccountsAddresses"
      mutability="view"
      description="List a user's subaccount addresses (addresses only)."
      wide
    >
      <Field label="user (address)" htmlFor="input-addresses-user-address">
        <Input
          id="input-addresses-user-address"
          data-testid="input-addresses-user-address"
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
        data-testid="button-read-addresses"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getUserSubAccountsAddresses" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useUserSubAccountsAddresses> }) {
  if (query.isLoading) {
    return <ListSkeleton rows={4} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see addresses.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No subaccounts found for this address.</ResultNote>;
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
