import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Input } from "./input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";

export interface MarketSelectItem {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  /** Text used by the built-in search. Falls back to id, label, description, and meta strings. */
  searchText?: string;
  disabled?: boolean;
}

export interface MarketSelectProps {
  idPrefix: string;
  value: string;
  items?: readonly MarketSelectItem[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: React.ReactNode;
  emptyResultsLabel?: React.ReactNode;
  clearLabel?: string;
  /**
   * Render the clear controls (the trigger's × and the picker's clear row).
   * Set `false` for a required field that must always hold a value.
   */
  clearable?: boolean;
  selectedLabel?: string;
  className?: string;
  /**
   * Controlled search term. Provide together with {@link MarketSelectProps.onSearchChange}
   * to drive search from the parent (server-side); when omitted the popover owns
   * the search box and filters `items` itself.
   */
  searchValue?: string;
  /**
   * Called on every search-input change. Its presence switches the popover into
   * **server mode**: it stops filtering `items` locally and renders them as given,
   * leaving search — and paging — to the parent.
   */
  onSearchChange?: (query: string) => void;
  /** Show a loading indicator in place of the list while the first page (or a new search) is in flight. */
  loading?: boolean;
  /** More pages are available — enables the scroll-to-end trigger. */
  hasMore?: boolean;
  /** A further page is loading — renders a footer spinner and guards the end-reached trigger from re-firing. */
  loadingMore?: boolean;
  /** Fired when the list is scrolled near its end; request the next page here. */
  onEndReached?: () => void;
}

/**
 * Non-editable selector field with searchable popover content. The trigger
 * shows only the selected item; typing happens inside the opened picker.
 */
function MarketSelect({
  idPrefix,
  value,
  items = [],
  onValueChange,
  placeholder = "Select market...",
  disabled,
  searchPlaceholder = "Search markets...",
  emptyLabel = "No markets.",
  emptyResultsLabel = "No markets match this search.",
  clearLabel = "Clear market",
  clearable = true,
  selectedLabel = "Selected",
  className,
  searchValue,
  onSearchChange,
  loading,
  hasMore,
  loadingMore,
  onEndReached,
}: MarketSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // Server mode: the parent owns the search term and the item list, so the popover
  // renders `items` as given instead of filtering them here.
  const serverMode = onSearchChange !== undefined;
  const searchTerm = serverMode ? (searchValue ?? "") : query;
  const selectedItem = React.useMemo(() => items.find((item) => item.id === value), [items, value]);
  const filteredItems = React.useMemo(() => filterItems(items, query), [items, query]);
  const listItems = serverMode ? items : filteredItems;
  const listEmptyLabel = serverMode
    ? searchTerm.trim() !== ""
      ? emptyResultsLabel
      : emptyLabel
    : items.length === 0
      ? emptyLabel
      : emptyResultsLabel;

  function handleSelect(item: MarketSelectItem) {
    onValueChange(item.id);
    setOpen(false);
    setQuery("");
  }

  function handleClear() {
    onValueChange("");
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
          <PopoverTrigger asChild>
            <button
              id={idPrefix}
              type="button"
              data-testid={`${idPrefix}-trigger`}
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                "bg-input/35 border-border hover:bg-input/55 focus-visible:border-ring focus-visible:ring-ring/30 h-9 w-full min-w-0 rounded-md border py-1 pr-10 pl-3 text-left text-base transition-[color,box-shadow,background-color,border-color] outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                selectedItem ? "text-foreground" : "text-muted-foreground",
                selectedItem && clearable && "pr-16",
              )}
            >
              <span className="block truncate">{selectedItem ? selectedItem.label : placeholder}</span>
              <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
            </button>
          </PopoverTrigger>

          {selectedItem && clearable ? (
            <button
              type="button"
              data-testid={`${idPrefix}-clear`}
              aria-label={clearLabel}
              disabled={disabled}
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 absolute top-1/2 right-8 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-(--radix-popover-trigger-width) overflow-hidden p-0"
        data-testid={`${idPrefix}-picker`}
      >
        <div className="bg-muted/35 border-border/70 border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(event) => (serverMode ? onSearchChange?.(event.target.value) : setQuery(event.target.value))}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoFocus
              data-testid={`${idPrefix}-search`}
              className="bg-background focus-visible:bg-background h-9 rounded-md pr-3 pl-9 shadow-none"
            />
          </div>
        </div>

        {selectedItem && clearable ? (
          <button
            type="button"
            data-testid={`${idPrefix}-clear-option`}
            onClick={() => {
              handleClear();
              setOpen(false);
            }}
            className="text-muted-foreground hover:bg-muted/60 focus-visible:bg-muted/60 flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm transition-colors outline-none"
          >
            <span>{clearLabel}</span>
            <X className="size-4" aria-hidden />
          </button>
        ) : null}

        <MarketSelectList
          idPrefix={idPrefix}
          items={listItems}
          selectedItemId={selectedItem?.id}
          emptyLabel={listEmptyLabel}
          selectedLabel={selectedLabel}
          onSelect={handleSelect}
          loading={loading}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onEndReached={onEndReached}
        />
      </PopoverContent>
    </Popover>
  );
}

function MarketSelectList({
  idPrefix,
  items,
  selectedItemId,
  emptyLabel,
  selectedLabel,
  onSelect,
  loading,
  hasMore,
  loadingMore,
  onEndReached,
}: {
  idPrefix: string;
  items: readonly MarketSelectItem[];
  selectedItemId?: string;
  emptyLabel: React.ReactNode;
  selectedLabel: string;
  onSelect: (item: MarketSelectItem) => void;
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onEndReached?: () => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    // Rows without a description measure ~40px, with one ~56px; the virtualizer
    // corrects each estimate from the real height via measureElement below.
    estimateSize: () => 52,
    overscan: 8,
    getItemKey: (index) => items[index]?.id ?? index,
  });

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    if (!onEndReached || !hasMore || loadingMore) return;
    const el = event.currentTarget;
    // Fire a little before the true bottom so the next page is already loading by
    // the time the user reaches it.
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) onEndReached();
  }

  if (items.length === 0) {
    return (
      <div data-testid={`${idPrefix}-list-empty`} className="text-muted-foreground px-3 py-6 text-center text-sm">
        {loading ? <Loader2 className="mx-auto size-4 animate-spin" aria-hidden /> : emptyLabel}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="max-h-64 overflow-y-auto p-1"
      data-testid={`${idPrefix}-list`}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;
          const selected = item.id === selectedItemId;
          return (
            <button
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              type="button"
              data-testid={`${idPrefix}-select`}
              aria-pressed={selected}
              disabled={item.disabled}
              onClick={() => onSelect(item)}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              className="hover:bg-muted/60 focus-visible:bg-muted/60 disabled:text-muted-foreground absolute top-0 left-0 flex w-full items-start justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-medium">{item.label}</span>
                {item.description ? (
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-5">{item.description}</span>
                ) : null}
              </span>
              <span className="flex shrink-0 items-start gap-2">
                {item.meta ? (
                  <span className={cn("mt-0.5 font-mono text-xs", selected ? "text-primary" : "text-muted-foreground")}>
                    {item.meta}
                  </span>
                ) : null}
                {selected ? (
                  <span className="text-primary mt-0.5 inline-flex shrink-0 items-center">
                    <Check className="size-4" aria-hidden />
                    <span className="sr-only">{selectedLabel}</span>
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      {loadingMore ? (
        <div className="flex items-center justify-center py-3" data-testid={`${idPrefix}-loading-more`}>
          <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}

function filterItems(items: readonly MarketSelectItem[], query: string): readonly MarketSelectItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => getItemSearchText(item).includes(normalized));
}

function getItemSearchText(item: MarketSelectItem): string {
  if (item.searchText) return item.searchText.toLowerCase();
  const parts = [item.id];
  if (typeof item.label === "string") parts.push(item.label);
  if (typeof item.description === "string") parts.push(item.description);
  if (typeof item.meta === "string") parts.push(item.meta);
  return parts.join(" ").toLowerCase();
}

export { MarketSelect };
