import { Check, Search, Users } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Input } from "./input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";
import { Skeleton } from "./skeleton";

export interface AccountPickerItem {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Optional right-aligned detail for the row, such as a status or amount. */
  detail?: React.ReactNode;
  /** Force the selected mark. When omitted, selection is derived from the field value. */
  selected?: boolean;
  disabled?: boolean;
}

export type AccountPickerListState = "idle" | "loading" | "error" | "empty" | "ready";

export interface AccountComboboxProps {
  /** Namespaces the field `id` and every `data-testid` (`{idPrefix}-account`, `-browse`, …). */
  idPrefix: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
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
  className?: string;
}

/**
 * Address field with a built-in account picker. Accepts a pasted/typed address
 * or a selection made through the trailing picker button, which opens a
 * searchable popover list. Pass `items`/`listState` from the data source that
 * resolves the selectable accounts; the picker filters them by name or address.
 *
 * @example
 * <AccountCombobox
 *   idPrefix="account"
 *   value={value}
 *   onValueChange={setValue}
 *   listState="ready"
 *   items={items}
 *   onSelect={(item) => setValue(item.id)}
 * />
 */
function AccountCombobox({
  idPrefix,
  value,
  onValueChange,
  placeholder,
  invalid,
  disabled,
  listState = "idle",
  listMessage,
  items = [],
  onSelect,
  browseLabel = "Browse accounts",
  searchPlaceholder = "Search by name or address…",
  emptyResultsLabel = "No matching accounts.",
  selectedLabel = "Selected",
  className,
}: AccountComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => filterItems(items, query), [items, query]);

  function handleSelect(item: AccountPickerItem) {
    onSelect(item);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <Input
            id={`${idPrefix}-account`}
            data-testid={`${idPrefix}-account`}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-10 font-mono"
            aria-invalid={invalid}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid={`${idPrefix}-browse`}
              aria-label={browseLabel}
              aria-expanded={open}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <Users className="size-4" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
        data-testid={`${idPrefix}-picker`}
      >
        <div className="border-border/70 flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            data-testid={`${idPrefix}-search`}
            className="placeholder:text-muted-foreground h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <AccountComboboxList
          idPrefix={idPrefix}
          state={listState}
          message={listMessage}
          items={filtered}
          value={value}
          emptyResultsLabel={emptyResultsLabel}
          selectedLabel={selectedLabel}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}

function AccountComboboxList({
  idPrefix,
  state,
  message,
  items,
  value,
  emptyResultsLabel,
  selectedLabel,
  onSelect,
}: {
  idPrefix: string;
  state: AccountPickerListState;
  message?: React.ReactNode;
  items: readonly AccountPickerItem[];
  value: string;
  emptyResultsLabel: React.ReactNode;
  selectedLabel: React.ReactNode;
  onSelect: (item: AccountPickerItem) => void;
}) {
  if (state === "loading") {
    return <AccountComboboxListSkeleton testId={`${idPrefix}-list-loading`} />;
  }

  if (state !== "ready") {
    return (
      <div data-testid={`${idPrefix}-list-${state}`} className="text-muted-foreground px-3 py-6 text-center text-sm">
        {message}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div data-testid={`${idPrefix}-list-no-results`} className="text-muted-foreground px-3 py-6 text-center text-sm">
        {emptyResultsLabel}
      </div>
    );
  }

  const normalizedValue = value.trim().toLowerCase();

  return (
    <div data-testid={`${idPrefix}-list`} className="max-h-64 overflow-y-auto p-1">
      {items.map((item) => {
        const isSelected = item.selected ?? item.id.toLowerCase() === normalizedValue;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`${idPrefix}-list-select`}
            disabled={item.disabled}
            onClick={() => onSelect(item)}
            className="hover:bg-muted/60 focus-visible:bg-muted/60 disabled:text-muted-foreground flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-sm font-medium">{item.title}</span>
              {item.meta ? (
                <span className="text-muted-foreground mt-0.5 block font-mono text-xs">{item.meta}</span>
              ) : null}
            </span>
            {item.detail || isSelected ? (
              <span className="inline-flex shrink-0 items-center gap-2">
                {item.detail ? (
                  <span className="text-muted-foreground max-w-32 truncate text-right text-xs">{item.detail}</span>
                ) : null}
                {isSelected ? (
                  <span className="text-primary inline-flex shrink-0 items-center">
                    <Check className="size-4" aria-hidden />
                    <span className="sr-only">{selectedLabel}</span>
                  </span>
                ) : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function AccountComboboxListSkeleton({ testId }: { testId: string }) {
  const rows = ["r0", "r1", "r2"];
  return (
    <div data-testid={testId} aria-busy="true" aria-label="Loading accounts" className="space-y-1 p-1">
      {rows.map((row) => (
        <div key={row} className="flex items-center justify-between gap-3 px-2.5 py-2">
          <span className="min-w-0 space-y-2">
            <Skeleton className="bg-muted-foreground/20 h-4 w-36" />
            <Skeleton className="bg-muted-foreground/15 h-3 w-24" />
          </span>
        </div>
      ))}
    </div>
  );
}

function filterItems(items: readonly AccountPickerItem[], query: string): readonly AccountPickerItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => itemSearchText(item).includes(normalized));
}

function itemSearchText(item: AccountPickerItem): string {
  const parts: string[] = [item.id];
  if (typeof item.title === "string") parts.push(item.title);
  if (typeof item.meta === "string") parts.push(item.meta);
  return parts.join(" ").toLowerCase();
}

export { AccountCombobox };
