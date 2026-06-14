"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { WEI_DECIMALS } from "@/lib/format";
import { OrderType, PositionType, QuoteStatus } from "@symm-frontier/core";
import { useQuote } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { formatTokenAmount } from "@symm-frontier/utils";
import { useState } from "react";
import { MethodCard } from "./method-card";

function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

function formatFixedPoint(raw: bigint): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 6 });
}

export function ReadGetQuote() {
  const [quoteId, setQuoteId] = useState<string>("");
  const validQuoteId = parseUint(quoteId);

  const query = useQuote({ quoteId: validQuoteId, query: { enabled: false } });

  return (
    <MethodCard
      testId="method-getQuote"
      name="getQuote"
      magicMethodId="quote"
      magicMethodInput={quoteId}
      mutability="view"
      description="Read a single quote by id. Resolves to ‘not found’ when no quote has that id."
      wide
    >
      <Field label="quoteId" htmlFor="input-quote-id">
        <Input
          id="input-quote-id"
          data-testid="input-quote-id"
          value={quoteId}
          onChange={(event) => setQuoteId(event.target.value)}
          placeholder="1"
          inputMode="numeric"
          aria-invalid={quoteId.length > 0 && validQuoteId === undefined}
        />
      </Field>

      <Button
        type="button"
        size="sm"
        disabled={validQuoteId === undefined || query.isFetching}
        onClick={() => void query.refetch()}
        data-testid="button-read-quote"
      >
        {query.isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getQuote" query={query} />
    </MethodCard>
  );
}

function ResultPanel({ testId, query }: { testId: string; query: ReturnType<typeof useQuote> }) {
  if (query.isLoading) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (query.data === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the quote.</ResultNote>;
  }
  if (query.data === null) {
    return <ResultNote testId={`${testId}-empty`}>No quote exists with that id.</ResultNote>;
  }
  const quote = query.data;
  return (
    <DataList data-testid={`${testId}-data`}>
      <DataRow label="id" value={String(quote.id)} mono />
      <DataRow label="market (symbolId)" value={String(quote.symbolId)} mono />
      <DataRow
        label="side"
        value={
          <Badge variant={quote.positionType === PositionType.LONG ? "positive" : "destructive"}>
            {PositionType[quote.positionType] ?? String(quote.positionType)}
          </Badge>
        }
      />
      <DataRow
        label="orderType"
        value={<Badge variant="secondary">{OrderType[quote.orderType] ?? String(quote.orderType)}</Badge>}
      />
      <DataRow
        label="status"
        value={<Badge variant="secondary">{QuoteStatus[quote.quoteStatus] ?? String(quote.quoteStatus)}</Badge>}
      />
      <DataRow label="quantity" value={formatFixedPoint(quote.quantity)} mono />
      <DataRow label="closedAmount" value={formatFixedPoint(quote.closedAmount)} mono />
      <DataRow label="openedPrice" value={formatFixedPoint(quote.openedPrice)} mono />
      <DataRow label="requestedOpenPrice" value={formatFixedPoint(quote.requestedOpenPrice)} mono />
      <DataRow label="partyA" value={<AddressTag address={quote.partyA} chars={6} />} />
      <DataRow label="partyB" value={<AddressTag address={quote.partyB} chars={6} />} />
      <DataRow label="createdAt" value={new Date(Number(quote.createTimestamp) * 1000).toLocaleString()} />
    </DataList>
  );
}
