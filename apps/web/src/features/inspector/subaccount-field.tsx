"use client";

import { Field } from "@/components/field";
import { useWalletAccount } from "@symmio/trading-react";
import { AccountCombobox } from "@symmio/ui/components/account-combobox";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { SubAccountListMessage, useSubAccountOptions } from "./subaccount-options";

interface Props {
  /** Namespaces the field `id` and the picker's `data-testid`s. */
  idPrefix: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  invalid?: boolean;
  /** Owner whose subaccounts populate the picker. Defaults to the connected wallet. */
  owner?: Address;
}

/**
 * A labelled subaccount address field with a built-in picker. Lets the user
 * paste any address or choose one of the owner's subaccounts (the connected
 * wallet by default). Drop-in replacement for a plain address `Field` + `Input`
 * anywhere a subaccount is an input.
 */
export function SubAccountField({
  idPrefix,
  label,
  value,
  onValueChange,
  hint,
  placeholder = "0x…",
  invalid,
  owner,
}: Props) {
  const { address } = useWalletAccount();
  const effectiveOwner = owner ?? address;
  const { query, items, listState } = useSubAccountOptions(effectiveOwner);

  return (
    <Field label={label} htmlFor={`${idPrefix}-account`} hint={hint}>
      <AccountCombobox
        idPrefix={idPrefix}
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
        invalid={invalid}
        items={items}
        listState={listState}
        listMessage={<SubAccountListMessage idPrefix={idPrefix} query={query} />}
        browseLabel="Browse subaccounts"
        searchPlaceholder="Search subaccounts…"
        emptyResultsLabel="No matching subaccounts."
        onSelect={(item) => onValueChange(item.id)}
      />
    </Field>
  );
}
