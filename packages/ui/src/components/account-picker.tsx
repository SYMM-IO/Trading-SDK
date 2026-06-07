import * as React from "react";

import { cn } from "../lib/utils";
import { AccountCombobox, type AccountPickerItem, type AccountPickerListState } from "./account-combobox";
import { Input } from "./input";
import { Label } from "./label";

export type { AccountPickerItem, AccountPickerListState };

export interface AccountPickerProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  idPrefix: string;
  ownerLabel?: React.ReactNode;
  ownerHint?: React.ReactNode;
  ownerValue: string;
  ownerPlaceholder?: string;
  ownerInvalid?: boolean;
  onOwnerValueChange: (value: string) => void;
  accountLabel?: React.ReactNode;
  accountHint?: React.ReactNode;
  accountValue: string;
  accountPlaceholder?: string;
  accountInvalid?: boolean;
  onAccountValueChange: (value: string) => void;
  listState?: AccountPickerListState;
  /** Message shown inside the picker for non-ready states (idle / error / empty). */
  listMessage?: React.ReactNode;
  items?: readonly AccountPickerItem[];
  onSelect: (item: AccountPickerItem) => void;
  /** Accessible label for the button that opens the picker. */
  browseLabel?: string;
  /** Placeholder for the picker's search field. */
  searchPlaceholder?: string;
  /** Shown when a search query matches none of the loaded accounts. */
  emptyResultsLabel?: React.ReactNode;
  selectedLabel?: React.ReactNode;
}

/**
 * Owner address input paired with an {@link AccountCombobox}. The owner field
 * drives which accounts are offered; the account field accepts a pasted address
 * or a selection made through the picker. Use this when the caller chooses the
 * owner; for a standalone account field whose options come from a fixed source,
 * use {@link AccountCombobox} directly.
 *
 * @example
 * <AccountPicker
 *   idPrefix="balance"
 *   ownerValue={owner}
 *   onOwnerValueChange={setOwner}
 *   accountValue={account}
 *   onAccountValueChange={setAccount}
 *   listState="ready"
 *   items={items}
 *   onSelect={(item) => setAccount(item.id)}
 * />
 */
function AccountPicker({
  idPrefix,
  ownerLabel = "owner",
  ownerHint,
  ownerValue,
  ownerPlaceholder,
  ownerInvalid,
  onOwnerValueChange,
  accountLabel = "account",
  accountHint,
  accountValue,
  accountPlaceholder,
  accountInvalid,
  onAccountValueChange,
  listState = "idle",
  listMessage,
  items = [],
  onSelect,
  browseLabel,
  searchPlaceholder,
  emptyResultsLabel,
  selectedLabel,
  className,
  ...props
}: AccountPickerProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      <AccountPickerField label={ownerLabel} htmlFor={`${idPrefix}-owner`} hint={ownerHint}>
        <Input
          id={`${idPrefix}-owner`}
          data-testid={`${idPrefix}-owner`}
          value={ownerValue}
          onChange={(event) => onOwnerValueChange(event.target.value)}
          placeholder={ownerPlaceholder}
          className="font-mono"
          aria-invalid={ownerInvalid}
        />
      </AccountPickerField>

      <AccountPickerField label={accountLabel} htmlFor={`${idPrefix}-account`} hint={accountHint}>
        <AccountCombobox
          idPrefix={idPrefix}
          value={accountValue}
          onValueChange={onAccountValueChange}
          placeholder={accountPlaceholder}
          invalid={accountInvalid}
          listState={listState}
          listMessage={listMessage}
          items={items}
          onSelect={onSelect}
          browseLabel={browseLabel}
          searchPlaceholder={searchPlaceholder}
          emptyResultsLabel={emptyResultsLabel}
          selectedLabel={selectedLabel}
        />
      </AccountPickerField>
    </div>
  );
}

function AccountPickerField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs leading-5">{hint}</p> : null}
    </div>
  );
}

export { AccountPicker };
