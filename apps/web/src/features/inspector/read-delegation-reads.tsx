"use client";

import { AddressTag } from "@/components/address-tag";
import { BoolBadge } from "@/components/bool-badge";
import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { DataRowsSkeleton } from "@/components/skeletons";
import { useDelegationExpiry, useIsDelegationActive, useSymmioConfig } from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { formatRelativeTimestamp } from "@symm-frontier/utils";
import { useState } from "react";
import type { Address, Hex } from "viem";
import { isAddress } from "viem";
import { getInstantLayerDelegateeSuggestions, InstantLayerDelegateeSuggestions } from "./instant-layer-delegatees";
import { InstantLayerSelectorSuggestions } from "./instant-layer-selectors";
import { MethodCard } from "./method-card";
import { SubAccountPicker } from "./subaccount-picker";

export function ReadDelegationReads() {
  const config = useSymmioConfig();
  const { solver } = config.getChainConfig();
  const [account, setAccount] = useState<string>("");
  const [delegate, setDelegate] = useState<string>("");
  const [selector, setSelector] = useState<string>("");

  const validAccount = isAddress(account) ? (account as Address) : undefined;
  const validDelegate = isAddress(delegate) ? (delegate as Address) : undefined;
  const validSelector = parseSelector(selector);

  return (
    <MethodCard
      testId="method-delegationReads"
      name="delegations / isDelegationActive"
      mutability="view"
      description="Read Instant Layer delegation expiry and active status for one account, delegate, and selector."
    >
      <SubAccountPicker
        idPrefix="delegation-account"
        selected={{ subAccount: validAccount }}
        onSelect={(selection) => setAccount(selection.subAccount ?? "")}
        accountLabel="account (address)"
        accountEmptyHint="Select a subaccount from the list or enter any account address manually."
        selectedHintLabel="Account"
      />

      <Field label="delegate" htmlFor="input-delegation-delegate" hint="The delegated signer address.">
        <Input
          id="input-delegation-delegate"
          data-testid="input-delegation-delegate"
          value={delegate}
          onChange={(e) => setDelegate(e.target.value)}
          placeholder="0x..."
          className="font-mono"
          aria-invalid={delegate.length > 0 && !validDelegate}
        />
      </Field>
      <InstantLayerDelegateeSuggestions
        suggestions={getInstantLayerDelegateeSuggestions(solver)}
        selected={validDelegate}
        onPick={(nextDelegate) => setDelegate(nextDelegate)}
      />

      <Field
        label="selector"
        htmlFor="input-delegation-selector"
        hint="One function selector as bytes4, for example 0x12345678."
      >
        <Input
          id="input-delegation-selector"
          data-testid="input-delegation-selector"
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
          placeholder="0x12345678"
          className="font-mono"
          aria-invalid={selector.length > 0 && !validSelector}
        />
      </Field>
      <InstantLayerSelectorSuggestions
        mode="single"
        selected={validSelector ? [validSelector] : []}
        onPick={(nextSelector) => setSelector(nextSelector)}
      />

      {validAccount && validDelegate && validSelector ? (
        <DelegationReadsResult account={validAccount} delegate={validDelegate} selector={validSelector} />
      ) : (
        <>
          <Button type="button" size="sm" disabled data-testid="button-read-delegation-reads">
            Read
          </Button>
          <ResultNote testId="result-delegationReads-idle">Enter account, delegate, and selector to read.</ResultNote>
        </>
      )}
    </MethodCard>
  );
}

function DelegationReadsResult({
  account,
  delegate,
  selector,
}: {
  account: Address;
  delegate: Address;
  selector: Hex;
}) {
  const expiryQuery = useDelegationExpiry({
    account,
    delegate,
    selector,
  });
  const activeQuery = useIsDelegationActive({
    account,
    delegate,
    selector,
  });
  const isFetching = expiryQuery.isFetching || activeQuery.isFetching;

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={isFetching}
        onClick={() => {
          void expiryQuery.refetch();
          void activeQuery.refetch();
        }}
        data-testid="button-read-delegation-reads"
      >
        {isFetching ? (
          <>
            <Spinner className="size-4" /> Reading...
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel
        testId="result-delegationReads"
        expiryQuery={expiryQuery}
        activeQuery={activeQuery}
        account={account}
        delegate={delegate}
      />
    </>
  );
}

function ResultPanel({
  testId,
  expiryQuery,
  activeQuery,
  account,
  delegate,
}: {
  testId: string;
  expiryQuery: ReturnType<typeof useDelegationExpiry>;
  activeQuery: ReturnType<typeof useIsDelegationActive>;
  account?: Address;
  delegate?: Address;
}) {
  if (expiryQuery.isLoading || activeQuery.isLoading) {
    return <DataRowsSkeleton rows={4} testId={`${testId}-loading`} />;
  }

  if (expiryQuery.error || activeQuery.error) {
    return (
      <div className="space-y-2">
        {expiryQuery.error ? (
          <ResultError
            testId={`${testId}-expiry-error`}
            kind={expiryQuery.error.kind}
            message={expiryQuery.error.message}
          />
        ) : null}
        {activeQuery.error ? (
          <ResultError
            testId={`${testId}-active-error`}
            kind={activeQuery.error.kind}
            message={activeQuery.error.message}
          />
        ) : null}
      </div>
    );
  }

  if (expiryQuery.data === undefined && activeQuery.data === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Enter account, delegate, and selector to read.</ResultNote>;
  }

  return (
    <DataList data-testid={`${testId}-data`}>
      {account ? <DataRow label="account" value={<AddressTag address={account} />} /> : null}
      {delegate ? <DataRow label="delegate" value={<AddressTag address={delegate} />} /> : null}
      <DataRow
        label="delegations"
        value={
          expiryQuery.data === undefined ? (
            <span className="text-muted-foreground">Not loaded</span>
          ) : (
            <span className="flex flex-col gap-1">
              <span>{formatExpiryTimestamp(expiryQuery.data)}</span>
              <span className="text-muted-foreground font-mono text-xs">{expiryQuery.data.toString()}</span>
            </span>
          )
        }
      />
      <DataRow
        label="isDelegationActive"
        value={
          activeQuery.data === undefined ? (
            <span className="text-muted-foreground">Not loaded</span>
          ) : (
            <BoolBadge value={activeQuery.data} />
          )
        }
      />
    </DataList>
  );
}

function parseSelector(value: string): Hex | undefined {
  const trimmed = value.trim();
  return /^0x[0-9a-fA-F]{8}$/.test(trimmed) ? (trimmed as Hex) : undefined;
}

function formatExpiryTimestamp(timestamp: bigint): string {
  return formatRelativeTimestamp(timestamp, {
    nowLabel: "expires now",
    formatFuture: (duration) => `expires in ${duration}`,
    formatPast: (duration) => `expired ${duration} ago`,
  });
}
