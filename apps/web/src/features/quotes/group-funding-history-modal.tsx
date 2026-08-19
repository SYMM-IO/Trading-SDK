"use client";

import { DEFAULT_PRICE_PRECISION, DEFAULT_QUANTITY_PRECISION } from "@/lib/format";
import type { QuoteGroup } from "@symmio/trading-core";
import { useMarkets, useQuoteGroupFundingHistory } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@symmio/ui/components/dialog";
import { useState } from "react";
import { QuoteEventsList } from "./quote-events-list";

interface Props {
  /** The grouped position whose funding ticks to list. */
  group: QuoteGroup;
}

/**
 * Opens the grouped position's funding history in a modal: every funding charge
 * across all of its child quotes, merged into one timeline, newest first.
 *
 * The history is a long list, so it lives in a modal rather than inline — the
 * expanded row keeps just the summary. The query runs only while the modal is
 * open.
 */
export function GroupFundingHistoryButton({ group }: Props) {
  const [open, setOpen] = useState(false);

  const marketsQuery = useMarkets();
  const market = marketsQuery.data?.find((m) => BigInt(m.symbolId ?? 0) === group.by.symbolId);
  const pricePrecision = market?.pricePrecision ?? DEFAULT_PRICE_PRECISION;
  const quantityPrecision = market?.quantityPrecision ?? DEFAULT_QUANTITY_PRECISION;

  const history = useQuoteGroupFundingHistory({ group, query: { enabled: open } });

  /** Only on-chain children have subgraph events; say how many the timeline covers. */
  const onchainCount = new Set(group.quotes.flatMap((quote) => (quote.quoteId === undefined ? [] : [quote.quoteId])))
    .size;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs" onClick={(event) => event.stopPropagation()}>
          <HistoryIcon data-icon="inline-start" />
          Funding history
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Funding history{market?.name ? ` · ${market.name}` : ""}</DialogTitle>
          <DialogDescription>
            Every funding charge across the {onchainCount} {onchainCount === 1 ? "quote" : "quotes"} in this position,
            newest first.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 max-h-[60vh] overflow-y-auto">
          <QuoteEventsList
            showQuoteId
            rows={history.data?.rows}
            isLoading={history.isLoading}
            hasMore={history.data?.hasMore}
            pricePrecision={pricePrecision}
            quantityPrecision={quantityPrecision}
            emptyText="No funding has been charged on this position yet."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Clock with a counter-clockwise arrow — history over time. */
function HistoryIcon(props: { "data-icon"?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
