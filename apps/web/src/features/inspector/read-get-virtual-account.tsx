"use client";

import { AddressTag } from "@/components/address-tag";
import { BoolBadge } from "@/components/bool-badge";
import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { DataRowsSkeleton } from "@/components/skeletons";
import {
  VIRTUAL_ACCOUNT_ISOLATION_TYPE,
  useVirtualAccount,
  type VirtualAccountIsolationType,
} from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { PartyAField } from "./party-a-field";

/**
 * Read a single Virtual Account's on-chain detail (parent subaccount, market
 * `symbolId`, isolation type, metadata). The picker is restricted to VAs so
 * the user can browse the connected wallet's subaccounts and pick one of
 * their VAs, or paste an address directly.
 */
export function ReadGetVirtualAccount() {
  const [input, setInput] = useState<string>("");
  const validAddress = isAddress(input) ? (input as Address) : undefined;

  const query = useVirtualAccount({
    account: validAddress,
    // Detail is fixed at VA creation — opt-in to refresh only via the Read
    // button; the hook's own default is already `staleTime: Infinity`.
    query: { enabled: false },
  });

  return (
    <MethodCard
      testId="method-getVirtualAccount"
      name="getVirtualAccount"
      mutability="view"
      description="Read a Virtual Account's detail: parent subaccount, market symbolId, isolation type, metadata."
      wide
    >
      <PartyAField
        idPrefix="get-virtual-account"
        label="account (virtual-account address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validAddress}
        selectable="va"
        hint="Browse the connected wallet's subaccounts and pick a VA — or paste an address directly."
      />

      <Button
        type="button"
        size="sm"
        disabled={!validAddress || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-virtual-account"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getVirtualAccount" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useVirtualAccount> }) {
  if (query.isLoading) {
    return <DataRowsSkeleton rows={6} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Pick or paste a VA address and read.</ResultNote>;
  }
  const va = query.data;
  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="accountAddress" value={<AddressTag address={va.accountAddress} />} />
      <DataRow label="parentAccount" value={<AddressTag address={va.parentAccount} />} />
      <DataRow label="symbolId" value={va.symbolId.toString()} />
      <DataRow
        label="isolationType"
        value={
          <Badge variant="secondary">
            {labelForIsolation(va.isolationType)} ({va.isolationType})
          </Badge>
        }
      />
      <DataRow label="isExists" value={<BoolBadge value={va.isExists} />} />
      <DataRow
        label="metadata"
        value={
          va.metadata === "0x" ? (
            <span className="text-muted-foreground">(none)</span>
          ) : (
            <span className="text-foreground max-w-[60ch] truncate font-mono text-xs">{va.metadata}</span>
          )
        }
      />
    </DataList>
  );
}

function labelForIsolation(isolation: VirtualAccountIsolationType): string {
  switch (isolation) {
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.POSITION:
      return "POSITION";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET:
      return "MARKET";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG:
      return "MARKET_LONG";
    case VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT:
      return "MARKET_SHORT";
    default:
      return "UNKNOWN";
  }
}
