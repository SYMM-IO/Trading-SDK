"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { formatUsd, isUnlimitedAllowance } from "@/lib/format";
import { useCollateralAllowance, useSymmioConfig, useWalletAccount } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";

export function ReadCollateralAllowance() {
  const { address } = useWalletAccount();
  const { addresses } = useSymmioConfig().getChainConfig();
  const [input, setInput] = useState<string>("");

  const candidate = (input || address || "") as string;
  const validOwner = isAddress(candidate) ? (candidate as Address) : undefined;

  const query = useCollateralAllowance({ owner: validOwner });

  return (
    <MethodCard
      testId="method-getCollateralAllowance"
      name="getCollateralAllowance"
      mutability="view"
      description="Read how much collateral an owner has approved the SYMMIO core to spend."
    >
      <Field label="owner (address)" htmlFor="input-allowance-owner">
        <Input
          id="input-allowance-owner"
          data-testid="input-allowance-owner"
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
        data-testid="button-read-allowance"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getCollateralAllowance" query={query} decimals={addresses.collateralDecimals} />
    </MethodCard>
  );
}

function ResultPanel({
  testId,
  query,
  decimals,
}: {
  testId: string;
  query: ReturnType<typeof useCollateralAllowance>;
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
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the allowance.</ResultNote>;
  }

  const raw = query.data;

  if (isUnlimitedAllowance(raw)) {
    return (
      <div data-testid={`${testId}-data`}>
        <Stat
          label="Allowance"
          value={
            <span className="inline-flex items-baseline gap-2">
              <span className="text-info">∞</span>
              Unlimited
            </span>
          }
          hint="Max approval — the core can spend any amount."
        />
      </div>
    );
  }

  return (
    <div data-testid={`${testId}-data`}>
      <Stat
        label="Allowance"
        value={raw === 0n ? "None" : formatUsd(raw, decimals)}
        hint={raw === 0n ? "This owner hasn't approved the core yet." : `${String(raw)} raw units`}
      />
    </div>
  );
}
