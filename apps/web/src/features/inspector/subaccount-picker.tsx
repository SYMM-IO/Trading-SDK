"use client";

import { useWalletAccount } from "@symmio/trading-react";
import { AccountPicker } from "@symmio/ui/components/account-picker";
import { shortenAddress } from "@symmio/utils";
import { useMemo, useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { SubAccountListMessage, useSubAccountOptions } from "./subaccount-options";

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

/** User-address input plus a searchable subaccount picker for inspector cards. */
export function SubAccountPicker({
  idPrefix,
  selected,
  onSelect,
  ownerLabel = "user (address)",
  ownerEmptyHint = "Enter a wallet address to load subaccounts.",
  accountLabel = "subAccount (address)",
  accountEmptyHint = "Pick a subaccount or enter one manually.",
  selectedHintLabel = "Selected",
}: Props) {
  const { address } = useWalletAccount();
  const [ownerInput, setOwnerInput] = useState("");
  const [subAccountInput, setSubAccountInput] = useState("");

  const ownerCandidate = (ownerInput || address || "") as string;
  const owner = isAddress(ownerCandidate) ? (ownerCandidate as Address) : undefined;
  const subAccount = isAddress(subAccountInput) ? (subAccountInput as Address) : undefined;
  const { query, items, listState } = useSubAccountOptions(owner);

  const selectedName = useMemo(() => {
    return selected.name ?? query.data?.find((sub) => sub.accountAddress === selected.subAccount)?.name;
  }, [query.data, selected.name, selected.subAccount]);

  const ownerHint = useMemo(() => {
    if (!owner) return ownerEmptyHint;
    const short = shortenAddress(owner);
    if (query.isLoading) return `Loading subaccounts for ${short}.`;
    if (query.error) return `Could not load subaccounts for ${short}.`;
    const count = query.data?.length ?? 0;
    if (count === 0) return `No subaccounts for ${short}.`;
    return `${count} subaccount${count === 1 ? "" : "s"} for ${short}.`;
  }, [owner, ownerEmptyHint, query.data, query.error, query.isLoading]);

  return (
    <AccountPicker
      idPrefix={idPrefix}
      ownerLabel={ownerLabel}
      ownerHint={ownerHint}
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
      listState={listState}
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
