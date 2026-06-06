"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { useUserSubAccounts, useWalletAccount } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Input } from "@symm-frontier/ui/components/input";
import { shortenAddress } from "@symm-frontier/utils";
import { useMemo, useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";

interface SelectedSubAccount {
  subAccount?: Address;
  name?: string;
}

interface Props {
  idPrefix: string;
  selected: SelectedSubAccount;
  onSelect: (selection: SelectedSubAccount) => void;
}

/** User-address input plus clickable subaccount list for inspector read cards. */
export function SubAccountPicker({ idPrefix, selected, onSelect }: Props) {
  const { address } = useWalletAccount();
  const [ownerInput, setOwnerInput] = useState("");
  const [subAccountInput, setSubAccountInput] = useState("");

  const ownerCandidate = (ownerInput || address || "") as string;
  const owner = isAddress(ownerCandidate) ? (ownerCandidate as Address) : undefined;
  const subAccount = isAddress(subAccountInput) ? (subAccountInput as Address) : undefined;
  const query = useUserSubAccounts({ user: owner });

  const selectedName = useMemo(() => {
    return selected.name ?? query.data?.find((sub) => sub.accountAddress === selected.subAccount)?.name;
  }, [query.data, selected.name, selected.subAccount]);

  return (
    <div className="space-y-4">
      <Field
        label="user (address)"
        htmlFor={`${idPrefix}-owner`}
        hint={
          owner ? `Loading subaccounts for ${shortenAddress(owner)}.` : "Enter a wallet address to load subaccounts."
        }
      >
        <Input
          id={`${idPrefix}-owner`}
          data-testid={`${idPrefix}-owner`}
          value={ownerInput}
          onChange={(event) => setOwnerInput(event.target.value)}
          placeholder={address ?? "0x…"}
          className="font-mono"
          aria-invalid={ownerCandidate.length > 0 && !owner}
        />
      </Field>

      <SubAccountList
        testId={`${idPrefix}-list`}
        query={query}
        selected={selected.subAccount}
        onSelect={(nextSubAccount, name) => {
          setSubAccountInput(nextSubAccount);
          onSelect({ subAccount: nextSubAccount, name });
        }}
      />

      <Field
        label="subAccount (address)"
        htmlFor={`${idPrefix}-subaccount`}
        hint={
          subAccount
            ? `Selected ${selectedName ? `${selectedName} · ` : ""}${shortenAddress(subAccount)}.`
            : "Click a subaccount or enter one manually."
        }
      >
        <Input
          id={`${idPrefix}-subaccount`}
          data-testid={`${idPrefix}-subaccount`}
          value={subAccountInput}
          onChange={(event) => {
            const next = event.target.value;
            setSubAccountInput(next);
            onSelect({ subAccount: isAddress(next) ? (next as Address) : undefined });
          }}
          placeholder="0x…"
          className="font-mono"
          aria-invalid={subAccountInput.length > 0 && !subAccount}
        />
      </Field>
    </div>
  );
}

function SubAccountList({
  testId,
  query,
  selected,
  onSelect,
}: {
  testId: string;
  query: ReturnType<typeof useUserSubAccounts>;
  selected?: Address;
  onSelect: (subAccount: Address, name?: string) => void;
}) {
  if (query.isLoading) {
    return <TableSkeleton rows={3} columns={2} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Connect a wallet or enter a user address.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No subaccounts found for this address.</ResultNote>;
  }

  return (
    <div data-testid={testId} className="border-border/70 overflow-hidden rounded-md border">
      <div className="divide-border/70 max-h-72 divide-y overflow-y-auto">
        {query.data.map((sub) => {
          const isSelected = sub.accountAddress === selected;
          return (
            <button
              key={sub.accountAddress}
              type="button"
              data-testid={`${testId}-select`}
              onClick={() => onSelect(sub.accountAddress, sub.name)}
              className="hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2"
            >
              <span className="min-w-0">
                <span className="text-foreground block truncate text-sm font-medium">{sub.name || "Unnamed"}</span>
                <span className="text-muted-foreground mt-0.5 block font-mono text-xs">
                  {shortenAddress(sub.accountAddress)}
                </span>
              </span>
              {isSelected ? <Badge variant="positive">Selected</Badge> : <Badge variant="secondary">Select</Badge>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
