"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { formatUsd } from "@/lib/format";
import { useCollateralBalance, useSymmioConfig, useWalletAccount } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";

export function ReadCollateralBalance() {
  const { address } = useWalletAccount();
  const { addresses } = useSymmioConfig().getChainConfig();
  const [input, setInput] = useState<string>("");

  const candidate = (input || address || "") as string;
  const validOwner = isAddress(candidate) ? (candidate as Address) : undefined;

  const query = useCollateralBalance({ owner: validOwner });

  return (
    <MethodCard
      testId="method-getCollateralBalance"
      name="getCollateralBalance"
      mutability="view"
      description="Read an address's wallet balance of the collateral token (USDC)."
    >
      <Field label="owner (address)" htmlFor="input-balance-owner">
        <Input
          id="input-balance-owner"
          data-testid="input-balance-owner"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={address ?? "0x…"}
          className="font-mono"
          aria-invalid={candidate.length > 0 && !validOwner}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={!validOwner || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-balance"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getCollateralBalance" query={query} decimals={addresses.collateralDecimals} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof useCollateralBalance>;
  decimals: number;
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
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the balance.</ResultNote>;
  }
  return (
    <div data-testid={`${testId}-data`}>
      <Stat label="Wallet balance" value={formatUsd(query.data, decimals)} hint={`${String(query.data)} raw units`} />
    </div>
  );
}
