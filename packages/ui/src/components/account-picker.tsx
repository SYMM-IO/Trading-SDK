import * as React from "react";

import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Input } from "./input";
import { Label } from "./label";
import { Skeleton } from "./skeleton";

export interface AccountPickerItem {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
}

export type AccountPickerListState = "idle" | "loading" | "error" | "empty" | "ready";

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
  listMessage?: React.ReactNode;
  items?: readonly AccountPickerItem[];
  onSelect: (item: AccountPickerItem) => void;
  selectedLabel?: React.ReactNode;
  actionLabel?: React.ReactNode;
}

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
  selectedLabel = "Selected",
  actionLabel = "Select",
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

      <AccountPickerList
        idPrefix={idPrefix}
        state={listState}
        message={listMessage}
        items={items}
        onSelect={onSelect}
        selectedLabel={selectedLabel}
        actionLabel={actionLabel}
      />

      <AccountPickerField label={accountLabel} htmlFor={`${idPrefix}-account`} hint={accountHint}>
        <Input
          id={`${idPrefix}-account`}
          data-testid={`${idPrefix}-account`}
          value={accountValue}
          onChange={(event) => onAccountValueChange(event.target.value)}
          placeholder={accountPlaceholder}
          className="font-mono"
          aria-invalid={accountInvalid}
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

function AccountPickerList({
  idPrefix,
  state,
  message,
  items,
  onSelect,
  selectedLabel,
  actionLabel,
}: {
  idPrefix: string;
  state: AccountPickerListState;
  message?: React.ReactNode;
  items: readonly AccountPickerItem[];
  onSelect: (item: AccountPickerItem) => void;
  selectedLabel: React.ReactNode;
  actionLabel: React.ReactNode;
}) {
  if (state === "loading") {
    return <AccountPickerListSkeleton testId={`${idPrefix}-list-loading`} />;
  }

  if (state !== "ready") {
    return message ? (
      <div data-testid={`${idPrefix}-list-${state}`} className="text-muted-foreground text-sm">
        {message}
      </div>
    ) : null;
  }

  return (
    <div data-testid={`${idPrefix}-list`} className="border-border/70 overflow-hidden rounded-md border">
      <div className="divide-border/70 max-h-72 divide-y overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`${idPrefix}-list-select`}
            disabled={item.disabled}
            onClick={() => onSelect(item)}
            className="hover:bg-muted/40 focus-visible:ring-ring disabled:bg-muted/20 disabled:text-muted-foreground flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
          >
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm font-medium">{item.title}</span>
              {item.meta ? (
                <span className="text-muted-foreground mt-0.5 block font-mono text-xs">{item.meta}</span>
              ) : null}
            </span>
            {item.selected ? (
              <Badge variant="positive">{selectedLabel}</Badge>
            ) : (
              <Badge variant="secondary">{actionLabel}</Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountPickerListSkeleton({ testId }: { testId: string }) {
  const rows = ["r0", "r1", "r2"];
  return (
    <div
      data-testid={testId}
      aria-busy="true"
      aria-label="Loading accounts"
      className="border-border/70 overflow-hidden rounded-md border"
    >
      <div className="divide-border/70 divide-y">
        {rows.map((row) => (
          <div key={row} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </span>
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { AccountPicker };
