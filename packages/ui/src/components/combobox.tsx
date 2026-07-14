import { Check, ChevronDown, RefreshCw, Search } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Input } from "./input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";
import { Spinner } from "./spinner";

export interface ComboboxItem {
  /** Stable id, and the value written to the field when picked in single mode. */
  id: string;
  title: React.ReactNode;
  /** Secondary line under the title — context about the option. */
  description?: React.ReactNode;
  /** Trailing/mono detail (an address, a selector, a count). */
  meta?: React.ReactNode;
  /**
   * Force the selected mark. When omitted, selection is derived from the field
   * value in single mode; pass it explicitly to drive checks in multiple mode.
   */
  selected?: boolean;
  disabled?: boolean;
}

export interface ComboboxProps {
  /** Namespaces the field `id` and every `data-testid` (`{idPrefix}-field`, `-browse`, …). */
  idPrefix: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (item: ComboboxItem) => void;
  items?: readonly ComboboxItem[];
  /**
   * `"single"` writes the picked item and closes the popover; `"multiple"`
   * leaves it open so several items can be toggled. Defaults to `"single"`.
   */
  mode?: "single" | "multiple";
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Icon inside the trailing trigger button. Defaults to a chevron. */
  triggerIcon?: React.ReactNode;
  /** Accessible label for the trailing trigger button. */
  triggerLabel?: string;
  /** Render a search box that filters items by title, meta, or id. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /**
   * When set (and `searchable`), a refresh button is shown at the end of the
   * search row that calls this — for reloading the items from their source.
   */
  onReload?: () => void;
  /** Show a spinner and disable the reload button while a refresh is in flight. */
  reloadPending?: boolean;
  /** Accessible label for the reload button. Defaults to `"Reload"`. */
  reloadLabel?: string;
  /** Shown when a search query matches none of the items. */
  emptyResultsLabel?: React.ReactNode;
  /** Shown when there are no items to pick from at all. */
  emptyLabel?: React.ReactNode;
  selectedLabel?: React.ReactNode;
  /** Render the field text in the mono face (addresses, hex selectors). */
  mono?: boolean;
  className?: string;
}

/**
 * A text field with a trailing button that opens a popover list of suggestions.
 * Accepts a typed/pasted value or a pick from the list. Use `mode="single"` for
 * one value (the field is set and the popover closes) or `mode="multiple"` to
 * toggle several options with the popover staying open — drive each row's check
 * with {@link ComboboxItem.selected}. Knows nothing about the option domain;
 * pass `items` from the data source and an `onSelect` that updates the field.
 *
 * @example
 * <Combobox
 *   idPrefix="delegate"
 *   value={value}
 *   onValueChange={setValue}
 *   items={items}
 *   triggerIcon={<Wallet className="size-4" />}
 *   triggerLabel="Browse delegatees"
 *   onSelect={(item) => setValue(item.id)}
 * />
 */
function Combobox({
  idPrefix,
  value,
  onValueChange,
  onSelect,
  items = [],
  mode = "single",
  placeholder,
  invalid,
  disabled,
  triggerIcon,
  triggerLabel = "Browse suggestions",
  searchable = false,
  searchPlaceholder = "Search…",
  onReload,
  reloadPending = false,
  reloadLabel = "Reload",
  emptyResultsLabel = "No matches.",
  emptyLabel = "Nothing to suggest.",
  selectedLabel = "Selected",
  mono = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => (searchable ? filterItems(items, query) : items), [items, query, searchable]);

  function handleSelect(item: ComboboxItem) {
    onSelect(item);
    if (mode === "single") {
      setOpen(false);
      setQuery("");
    }
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
            id={`${idPrefix}-field`}
            data-testid={`${idPrefix}-field`}
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;
              onValueChange(nextValue);
              if (searchable) setQuery(nextValue);
              setOpen(true);
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={cn("pr-10", mono && "font-mono")}
            aria-invalid={invalid}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid={`${idPrefix}-browse`}
              aria-label={triggerLabel}
              aria-expanded={open}
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {triggerIcon ?? <ChevronDown className="size-4" />}
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
        data-testid={`${idPrefix}-picker`}
      >
        {searchable ? (
          <div className="border-border/70 flex items-center gap-2 border-b px-3">
            <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              data-testid={`${idPrefix}-search`}
              className="placeholder:text-muted-foreground h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {onReload ? (
              <button
                type="button"
                onClick={() => onReload()}
                disabled={reloadPending}
                aria-label={reloadLabel}
                title={reloadLabel}
                data-testid={`${idPrefix}-reload`}
                className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {reloadPending ? <Spinner className="size-4" /> : <RefreshCw className="size-4" aria-hidden />}
              </button>
            ) : null}
          </div>
        ) : null}

        <ComboboxList
          idPrefix={idPrefix}
          items={filtered}
          value={value}
          mode={mode}
          emptyLabel={items.length === 0 ? emptyLabel : emptyResultsLabel}
          selectedLabel={selectedLabel}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}

function ComboboxList({
  idPrefix,
  items,
  value,
  mode,
  emptyLabel,
  selectedLabel,
  onSelect,
}: {
  idPrefix: string;
  items: readonly ComboboxItem[];
  value: string;
  mode: "single" | "multiple";
  emptyLabel: React.ReactNode;
  selectedLabel: React.ReactNode;
  onSelect: (item: ComboboxItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div data-testid={`${idPrefix}-list-empty`} className="text-muted-foreground px-3 py-6 text-center text-sm">
        {emptyLabel}
      </div>
    );
  }

  const normalizedValue = value.trim().toLowerCase();

  return (
    <div data-testid={`${idPrefix}-list`} className="max-h-64 overflow-y-auto p-1">
      {items.map((item) => {
        const isSelected = item.selected ?? (mode === "single" && item.id.toLowerCase() === normalizedValue);
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`${idPrefix}-list-select`}
            disabled={item.disabled}
            aria-pressed={mode === "multiple" ? isSelected : undefined}
            onClick={() => onSelect(item)}
            className="hover:bg-muted/60 focus-visible:bg-muted/60 disabled:text-muted-foreground flex w-full items-start justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm font-medium">{item.title}</span>
              {item.description ? (
                <span className="text-muted-foreground mt-0.5 block text-xs leading-5">{item.description}</span>
              ) : null}
              {item.meta ? (
                <span className="text-muted-foreground mt-1 block font-mono text-xs">{item.meta}</span>
              ) : null}
            </span>
            {isSelected ? (
              <span className="text-primary mt-0.5 inline-flex shrink-0 items-center">
                <Check className="size-4" aria-hidden />
                <span className="sr-only">{selectedLabel}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function filterItems(items: readonly ComboboxItem[], query: string): readonly ComboboxItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => itemSearchText(item).includes(normalized));
}

function itemSearchText(item: ComboboxItem): string {
  const parts: string[] = [item.id];
  if (typeof item.title === "string") parts.push(item.title);
  if (typeof item.description === "string") parts.push(item.description);
  if (typeof item.meta === "string") parts.push(item.meta);
  return parts.join(" ").toLowerCase();
}

export { Combobox };
