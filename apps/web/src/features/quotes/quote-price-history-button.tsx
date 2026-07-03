"use client";

import { DEFAULT_PRICE_PRECISION, DEFAULT_QUANTITY_PRECISION } from "@/lib/format";
import { useMarkets, useQuotePriceHistory } from "@symmio/trading-react";
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
  /** On-chain quote id whose history to show. The button is disabled when this is `undefined`. */
  quoteId: bigint | undefined;
  /** Market id, used to resolve display precisions. */
  symbolId: bigint;
}

/**
 * Inline button rendered next to a quote's open price in the quotes table.
 * Clicking it opens a modal listing the quote's price-history events
 * (settle-uPnL recomputes and funding-rate ticks). The query runs only while the
 * modal is open.
 */
export function QuotePriceHistoryButton({ quoteId, symbolId }: Props) {
  const [open, setOpen] = useState(false);
  const marketsQuery = useMarkets();
  const market = marketsQuery.data?.find((m) => BigInt(m.symbol_id ?? 0) === symbolId);
  const pricePrecision = market?.price_precision ?? DEFAULT_PRICE_PRECISION;
  const quantityPrecision = market?.quantity_precision ?? DEFAULT_QUANTITY_PRECISION;

  const priceHistory = useQuotePriceHistory({
    quoteId: quoteId ?? 0n,
    query: { enabled: open && quoteId !== undefined },
  });

  if (quoteId === undefined) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        aria-label="View price history"
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex size-5 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
        onClick={(event) => event.stopPropagation()}
      >
        <ClockIcon />
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Price history · quote #{quoteId.toString()}</DialogTitle>
          <DialogDescription>
            Open-price recomputes and funding-rate ticks for this quote, newest first.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 max-h-[60vh] overflow-y-auto">
          <QuoteEventsList
            rows={priceHistory.data?.rows}
            isLoading={priceHistory.isLoading}
            hasMore={priceHistory.data?.hasMore}
            pricePrecision={pricePrecision}
            quantityPrecision={quantityPrecision}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
