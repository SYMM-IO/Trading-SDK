"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useUserSubAccounts, useWalletAccount } from "@symm-frontier/react";
import {
  AccountPicker,
  type AccountPickerItem,
  type AccountPickerListState,
} from "@symm-frontier/ui/components/account-picker";
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
  ownerLabel?: string;
  ownerEmptyHint?: string;
  accountLabel?: string;
  accountEmptyHint?: string;
  selectedHintLabel?: string;
}

/** User-address input plus clickable subaccount list for inspector read cards. */
export function SubAccountPicker({
  idPrefix,
  selected,
  onSelect,
  ownerLabel = "user (address)",
  ownerEmptyHint = "Enter a wallet address to load subaccounts.",
  accountLabel = "subAccount (address)",
  accountEmptyHint = "Click a subaccount or enter one manually.",
  selectedHintLabel = "Selected",
}: Props) {
  const { address } = useWalletAccount();
  const [ownerInput, setOwnerInput] = useState("");
  const [subAccountInput, setSubAccountInput] = useState("");

  const ownerCandidate = (ownerInput || address || "") as string;
  const owner = isAddress(ownerCandidate) ? (ownerCandidate as Address) : undefined;
  const subAccount = isAddress(subAccountInput) ? (subAccountInput as Address) : undefined;
  const query = useUserSubAccounts({ user: owner });

  const items = useMemo(
    () =>
      query.data?.map(
        (sub): AccountPickerItem => ({
          id: sub.accountAddress,
          title: sub.name || "Unnamed",
          meta: shortenAddress(sub.accountAddress),
          selected: sub.accountAddress === selected.subAccount,
        }),
      ) ?? [],
    [query.data, selected.subAccount],
  );

  const selectedName = useMemo(() => {
    return selected.name ?? query.data?.find((sub) => sub.accountAddress === selected.subAccount)?.name;
  }, [query.data, selected.name, selected.subAccount]);

  return (
    <AccountPicker
      idPrefix={idPrefix}
      ownerLabel={ownerLabel}
      ownerHint={owner ? `Loading subaccounts for ${shortenAddress(owner)}.` : ownerEmptyHint}
      ownerValue={ownerInput}
      ownerPlaceholder={address ?? "0x..."}
      ownerInvalid={ownerCandidate.length > 0 && !owner}
      onOwnerValueChange={setOwnerInput}
      accountLabel={accountLabel}
      accountHint={
        subAccount
          ? `${selectedHintLabel} ${selectedName ? `${selectedName} · ` : ""}${shortenAddress(subAccount)}.`
          : accountEmptyHint
      }
      accountValue={subAccountInput}
      accountPlaceholder="0x..."
      accountInvalid={subAccountInput.length > 0 && !subAccount}
      onAccountValueChange={(next) => {
        setSubAccountInput(next);
        onSelect({ subAccount: isAddress(next) ? (next as Address) : undefined });
      }}
      listState={getListState(query)}
      listMessage={<SubAccountListMessage idPrefix={idPrefix} query={query} />}
      items={items}
      onSelect={(item) => {
        const nextSubAccount = item.id as Address;
        setSubAccountInput(nextSubAccount);
        onSelect({
          subAccount: nextSubAccount,
          name: typeof item.title === "string" ? item.title : undefined,
        });
      }}
    />
  );
}

function getListState(query: ReturnType<typeof useUserSubAccounts>): AccountPickerListState {
  if (query.isLoading) return "loading";
  if (query.error) return "error";
  if (!query.data) return "idle";
  if (query.data.length === 0) return "empty";
  return "ready";
}

function SubAccountListMessage({
  idPrefix,
  query,
}: {
  idPrefix: string;
  query: ReturnType<typeof useUserSubAccounts>;
}) {
  if (query.error) {
    return <ResultError testId={`${idPrefix}-list-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${idPrefix}-list-idle`}>Connect a wallet or enter a user address.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${idPrefix}-list-empty`}>No subaccounts found for this address.</ResultNote>;
  }
  return null;
}
