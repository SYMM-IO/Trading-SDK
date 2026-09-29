"use client";
import type { UnifiedQuote } from "@symmio/trading-core";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QuoteCard } from "./quote-card";
import { QuoteDetailPanel } from "./quote-detail-panel";
import { quoteCreatedSeconds } from "./quote-format";
import { useMarketDisplay, type MarketDisplayLookup } from "./use-market-display";

/** Orderings offered in place of the sortable column headers a card list does not have. */
const SORTS = {
  newest: "Newest",
  oldest: "Oldest",
  largest: "Largest",
  market: "Market",
} as const;

type SortKey = keyof typeof SORTS;

/**
 * A durable handle on the quote whose detail is open.
 *
 * The reconciler rewrites a row's `key` the moment it anchors on chain
 * (`temp:-199` becomes `onchain:177`), so holding the key alone would slam the
 * detail shut at exactly the moment the user was watching it land. Keeping the
 * ids alongside lets the panel follow the row through its own anchoring.
 */
interface OpenRef {
  key: string;
  quoteId?: bigint;
  tempQuoteId?: number;
}

function toOpenRef(quote: UnifiedQuote): OpenRef {
  return { key: quote.key, quoteId: quote.quoteId, tempQuoteId: quote.tempQuoteId };
}

/** Re-resolve the open quote across a re-key, by id when the key no longer matches. */
function resolveOpen(quotes: UnifiedQuote[], ref: OpenRef): UnifiedQuote | undefined {
  const byKey = quotes.find((quote) => quote.key === ref.key);
  if (byKey) return byKey;
  if (ref.tempQuoteId !== undefined) {
    const byTemp = quotes.find((quote) => quote.tempQuoteId === ref.tempQuoteId);
    if (byTemp) return byTemp;
  }
  if (ref.quoteId !== undefined) {
    return quotes.find((quote) => quote.quoteId === ref.quoteId);
  }
  return undefined;
}

function sortQuotes(quotes: UnifiedQuote[], sort: SortKey, marketOf: MarketDisplayLookup): UnifiedQuote[] {
  const rows = [...quotes];
  switch (sort) {
    case "oldest":
      return rows.sort((a, b) => Number(quoteCreatedSeconds(a) ?? 0n) - Number(quoteCreatedSeconds(b) ?? 0n));
    case "largest":
      return rows.sort((a, b) => (b.openQuantity > a.openQuantity ? 1 : b.openQuantity < a.openQuantity ? -1 : 0));
    case "market":
      return rows.sort((a, b) => marketOf(a.symbolId).name.localeCompare(marketOf(b.symbolId).name));
    default:
      return rows.sort((a, b) => Number(quoteCreatedSeconds(b) ?? 0n) - Number(quoteCreatedSeconds(a) ?? 0n));
  }
}

function matches(quote: UnifiedQuote, term: string, marketOf: MarketDisplayLookup): boolean {
  if (term.length === 0) return true;
  return (
    quote.key.toLowerCase().includes(term) ||
    String(quote.quoteId ?? "").includes(term) ||
    String(quote.tempQuoteId ?? "").includes(term) ||
    String(quote.symbolId).includes(term) ||
    marketOf(quote.symbolId).name.toLowerCase().includes(term) ||
    (quote.vaAddress ?? "").toLowerCase().includes(term)
  );
}

interface Props {
  quotes: UnifiedQuote[];
  /** Shown in place of cards when there are no quotes at all. */
  emptyMessage?: ReactNode;
  /** Prefix for `data-testid` hooks. */
  testId?: string;
  /**
   * Render the filter and sort strip. Off when the caller already supplies its
   * own search control above the surface, so the two never stack.
   */
  showControls?: boolean;
}

/**
 * The quote feed as a list of cards, for any container too narrow for the table.
 *
 * Opening a quote **replaces** the list rather than pushing it down. The card
 * body is height-capped, so an in-place expansion would put the detail below
 * whatever the reader was looking at and leave a scroll position to recover;
 * taking over the column gives the panel the full height and makes the way back
 * one deliberate control. Disclosure follows the representation, not the
 * breakpoint — the table, which has room for both, still expands in place.
 *
 * With no column headers there is nothing to click to sort, so sorting moves
 * into the pinned strip beside the filter.
 */
export function QuoteCardList({
  quotes,
  emptyMessage = "No quotes for this partyA.",
  testId,
  showControls = true,
}: Props) {
  const marketOf = useMarketDisplay();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [openRef, setOpenRef] = useState<OpenRef | null>(null);

  const open = openRef ? resolveOpen(quotes, openRef) : undefined;

  /** A quote that leaves the feed entirely (fully closed) has no detail left to show. */
  useEffect(() => {
    if (openRef && !resolveOpen(quotes, openRef)) setOpenRef(null);
  }, [openRef, quotes]);

  /** Follow the row through an anchor so the next re-key still resolves by key. */
  useEffect(() => {
    if (open && openRef && open.key !== openRef.key) setOpenRef(toOpenRef(open));
  }, [open, openRef]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortQuotes(
      quotes.filter((quote) => matches(quote, term, marketOf)),
      sort,
      marketOf,
    );
  }, [quotes, search, sort, marketOf]);

  if (open) {
    return (
      <QuoteDetailPanel
        quote={open}
        market={marketOf(open.symbolId)}
        variant="drill-in"
        onBack={() => setOpenRef(null)}
        testId={testId ? `${testId}-detail` : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid={testId}>
      {showControls && quotes.length > 1 ? (
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Market, id, address"
            containerClassName="flex-1 min-w-0"
            className="h-8 text-xs"
            aria-label="Filter quotes"
            data-testid={testId ? `${testId}-search` : undefined}
          />
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger
              className="h-8 w-auto shrink-0 text-xs"
              aria-label="Sort quotes"
              data-testid={testId ? `${testId}-sort` : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p
          className="text-muted-foreground px-1 py-6 text-center text-xs"
          data-testid={testId ? `${testId}-empty` : undefined}
        >
          {quotes.length === 0 ? emptyMessage : "No quotes match this filter."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((quote) => (
            <li key={quote.key}>
              <QuoteCard quote={quote} market={marketOf(quote.symbolId)} onOpen={() => setOpenRef(toOpenRef(quote))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
