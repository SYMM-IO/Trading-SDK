"use client";

import { AddressTag } from "@/components/address-tag";
import { BoolBadge } from "@/components/bool-badge";
import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { DataRowsSkeleton } from "@/components/skeletons";
import { useDelegationExpiry, useIsDelegationActive, useSymmioConfig } from "@theoldvarorg/react";
import { Button } from "@theoldvarorg/ui/components/button";
import { Combobox } from "@theoldvarorg/ui/components/combobox";
import { Spinner } from "@theoldvarorg/ui/components/spinner";
import { formatRelativeTimestamp } from "@theoldvarorg/utils";
import { useState } from "react";
import type { Address, Hex } from "viem";
import { isAddress } from "viem";
import { useSessionKey } from "../session-keys/use-session-key";
import { getInstantLayerDelegateeSuggestions, toDelegateeComboboxItems } from "./instant-layer-delegatees";
import { SelectorIcon, WalletIcon } from "./instant-layer-icons";
import { toSelectorComboboxItems } from "./instant-layer-selectors";
import { MethodCard } from "./method-card";
import { SubAccountPicker } from "./subaccount-picker";

export function ReadDelegationReads() {
  const config = useSymmioConfig();
  const { solver } = config.getChainConfig();
  const { sessionKeyAddress } = useSessionKey();
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

      <Field label="delegate" htmlFor="delegation-delegate-field" hint="The delegated signer address.">
        <Combobox
          idPrefix="delegation-delegate"
          value={delegate}
          onValueChange={setDelegate}
          onSelect={(item) => setDelegate(item.id)}
          items={toDelegateeComboboxItems(
            getInstantLayerDelegateeSuggestions(solver, sessionKeyAddress ?? undefined),
            validDelegate,
          )}
          placeholder="0x..."
          mono
          invalid={delegate.length > 0 && !validDelegate}
          triggerIcon={<WalletIcon />}
          triggerLabel="Browse delegatees"
        />
      </Field>

      <Field
        label="selector"
        htmlFor="delegation-selector-field"
        hint="One function selector as bytes4, for example 0x12345678."
      >
        <Combobox
          idPrefix="delegation-selector"
          value={selector}
          onValueChange={setSelector}
          onSelect={(item) => setSelector(item.id)}
          items={toSelectorComboboxItems(validSelector ? [validSelector] : [])}
          placeholder="0x12345678"
          mono
          invalid={selector.length > 0 && !validSelector}
          triggerIcon={<SelectorIcon />}
          triggerLabel="Browse selectors"
        />
      </Field>

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
