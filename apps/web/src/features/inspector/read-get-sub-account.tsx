"use client";

import { AddressTag } from "@/components/address-tag";
import { BoolBadge } from "@/components/bool-badge";
import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { DataRowsSkeleton } from "@/components/skeletons";
import { useSubAccount } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

export function ReadGetSubAccount() {
  const [input, setInput] = useState<string>("");
  const validAddress = isAddress(input) ? (input as Address) : undefined;

  const query = useSubAccount({ account: validAddress });

  return (
    <MethodCard
      testId="method-getSubAccount"
      name="getSubAccount"
      mutability="view"
      description="Read a single subaccount by its address."
      wide
    >
      <SubAccountField
        idPrefix="getsubaccount"
        label="account (subaccount address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validAddress}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validAddress || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-subaccount"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getSubAccount" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useSubAccount> }) {
  if (query.isLoading) {
    return <DataRowsSkeleton rows={7} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Enter a subaccount address and read.</ResultNote>;
  }
  const sub = query.data;
  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="name" value={sub.name || <span className="text-muted-foreground">(unnamed)</span>} />
      <DataRow label="owner" value={<AddressTag address={sub.owner} />} />
      <DataRow label="affiliate" value={<AddressTag address={sub.affiliate} />} />
      <DataRow label="symmioCore" value={<AddressTag address={sub.symmioCore} />} />
      <DataRow label="isolationType" value={<Badge variant="secondary">{String(sub.isolationType)}</Badge>} />
      <DataRow label="singleVAMode" value={<BoolBadge value={sub.singleVAMode} />} />
      <DataRow label="isExists" value={<BoolBadge value={sub.isExists} />} />
    </DataList>
  );
}
