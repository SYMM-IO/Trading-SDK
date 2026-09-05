"use client";

import { Field } from "@/components/field";
import { ResultNote } from "@/components/result";
import { QuoteEventsList } from "@/features/quotes/quote-events-list";
import { useQuotePriceHistory } from "@symmio/trading-react";
import { Input } from "@symmio/ui/components/input";
import { useState } from "react";
import { MethodCard } from "./method-card";

/** Parse a non-negative integer string to `bigint`, or `undefined` when it is not one. */
function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

/**
 * A quote's **price history** from the analytics subgraph — the standalone card
 * for {@link useQuotePriceHistory} (core `getQuoteEventsByType`, price-history
 * preset). Enter a quote id and it lists that quote's open-price recomputes
 * (`SETTLE_UPNL`) and funding-rate ticks (`CHARGE_FUNDING_RATE`,
 * `CHARGE_ACCUMULATED_FUNDING_FEE`), newest first, decoded from each event's
 * metadata.
 *
 * The read runs only for a valid id; it fires against the chain's analytics
 * subgraph, so it needs no wallet and no sign-in.
 */
export function ReadQuotePriceHistory() {
  const [quoteId, setQuoteId] = useState("");
  const validQuoteId = parseUint(quoteId);

  const priceHistory = useQuotePriceHistory({
    quoteId: validQuoteId ?? 0n,
    query: { enabled: validQuoteId !== undefined },
  });

  return (
    <MethodCard
      testId="method-getQuotePriceHistory"
      name="getQuoteEventsByType"
      mutability="view"
      description="A quote's price history from the analytics subgraph, via useQuotePriceHistory — settle-uPnL open-price recomputes and funding-rate ticks, newest first. Enter a quote id to read it."
      wide
    >
      <Field label="quoteId" htmlFor="input-price-history-quote-id">
        <Input
          id="input-price-history-quote-id"
          data-testid="input-price-history-quote-id"
          value={quoteId}
          onChange={(event) => setQuoteId(event.target.value)}
          placeholder="1"
          inputMode="numeric"
          aria-invalid={quoteId.length > 0 && validQuoteId === undefined}
        />
      </Field>

      {validQuoteId === undefined ? (
        <ResultNote testId="price-history-idle">Enter a quote id to read its price history.</ResultNote>
      ) : (
        <QuoteEventsList
          rows={priceHistory.data?.rows}
          isLoading={priceHistory.isLoading}
          hasMore={priceHistory.data?.hasMore}
        />
      )}
    </MethodCard>
  );
}
