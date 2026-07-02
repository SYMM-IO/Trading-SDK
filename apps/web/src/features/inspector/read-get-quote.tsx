"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { Field } from "@/components/field";
import { ResultError, ResultNote } from "@/components/result";
import { QuoteEventsList } from "@/features/quotes/quote-events-list";
import { WEI_DECIMALS } from "@/lib/format";
import { OrderType, PositionType, QuoteStatus } from "@symm-frontier/core";
import { useQuote, useQuotePriceHistory, useQuoteTpSl } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { formatTokenAmount } from "@symm-frontier/utils";
import { useState, type ReactNode } from "react";
import type { Address, Hex } from "viem";
import { MethodCard } from "./method-card";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function parseUint(value: string): bigint | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  return BigInt(value.trim());
}

function formatFixedPoint(raw: bigint): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 6 });
}

function formatSignedFixedPoint(raw: bigint): string {
  if (raw >= 0n) return formatFixedPoint(raw);
  return `-${formatFixedPoint(-raw)}`;
}

function formatTimestamp(seconds: bigint): string | undefined {
  if (seconds === 0n) return undefined;
  return new Date(Number(seconds) * 1000).toLocaleString();
}

function formatHex(value: Hex): string {
  if (value === "0x" || value.length === 0) return "0x";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
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
  const partyBIsZero = quote.partyB.toLowerCase() === ZERO_ADDRESS;
  const affiliateIsZero = quote.affiliate.toLowerCase() === ZERO_ADDRESS;

  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-5">
      <Section title="Identity">
        <DataList>
          <DataRow label="id" value={String(quote.id)} mono />
          <DataRow label="parentId" value={quote.parentId === 0n ? undefined : String(quote.parentId)} mono />
          <DataRow label="partyA" value={<AddressTag address={quote.partyA} chars={6} />} />
          <DataRow label="partyB" value={partyBIsZero ? undefined : <AddressTag address={quote.partyB} chars={6} />} />
          <DataRow
            label="affiliate"
            value={affiliateIsZero ? undefined : <AddressTag address={quote.affiliate} chars={6} />}
          />
          <DataRow label="partyBsWhiteList" value={<WhitelistValue list={quote.partyBsWhiteList} />} />
        </DataList>
      </Section>

      <Section title="Market & Status">
        <DataList>
          <DataRow label="symbolId" value={String(quote.symbolId)} mono />
          <DataRow
            label="positionType"
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
            label="quoteStatus"
            value={<Badge variant="secondary">{QuoteStatus[quote.quoteStatus] ?? String(quote.quoteStatus)}</Badge>}
          />
        </DataList>
      </Section>

      <Section title="Prices">
        <DataList>
          <DataRow label="requestedOpenPrice" value={formatFixedPoint(quote.requestedOpenPrice)} mono />
          <DataRow label="openedPrice" value={formatFixedPoint(quote.openedPrice)} mono />
          <DataRow label="initialOpenedPrice" value={formatFixedPoint(quote.initialOpenedPrice)} mono />
          <DataRow label="marketPrice" value={formatFixedPoint(quote.marketPrice)} mono />
          <DataRow label="requestedClosePrice" value={formatFixedPoint(quote.requestedClosePrice)} mono />
          <DataRow label="avgClosedPrice" value={formatFixedPoint(quote.avgClosedPrice)} mono />
        </DataList>
      </Section>

      <Section title="Size">
        <DataList>
          <DataRow label="quantity" value={formatFixedPoint(quote.quantity)} mono />
          <DataRow label="closedAmount" value={formatFixedPoint(quote.closedAmount)} mono />
          <DataRow label="quantityToClose" value={formatFixedPoint(quote.quantityToClose)} mono />
        </DataList>
      </Section>

      <Section title="Locked Values (current)">
        <DataList>
          <DataRow label="cva" value={formatFixedPoint(quote.lockedValues.cva)} mono />
          <DataRow label="lf" value={formatFixedPoint(quote.lockedValues.lf)} mono />
          <DataRow label="partyAmm" value={formatFixedPoint(quote.lockedValues.partyAmm)} mono />
          <DataRow label="partyBmm" value={formatFixedPoint(quote.lockedValues.partyBmm)} mono />
        </DataList>
      </Section>

      <Section title="Locked Values (initial)">
        <DataList>
          <DataRow label="cva" value={formatFixedPoint(quote.initialLockedValues.cva)} mono />
          <DataRow label="lf" value={formatFixedPoint(quote.initialLockedValues.lf)} mono />
          <DataRow label="partyAmm" value={formatFixedPoint(quote.initialLockedValues.partyAmm)} mono />
          <DataRow label="partyBmm" value={formatFixedPoint(quote.initialLockedValues.partyBmm)} mono />
        </DataList>
      </Section>

      <Section title="Funding & Fees">
        <DataList>
          <DataRow label="maxFundingRate" value={String(quote.maxFundingRate)} mono />
          <DataRow label="accumulatedPaidFunding" value={formatSignedFixedPoint(quote.accumulatedPaidFunding)} mono />
          <DataRow label="tradingFee" value={formatFixedPoint(quote.tradingFee)} mono />
          <DataRow label="closeFee" value={formatFixedPoint(quote.closeFee)} mono />
          <DataRow label="lastFundingPaymentTimestamp" value={formatTimestamp(quote.lastFundingPaymentTimestamp)} />
        </DataList>
      </Section>

      <Section title="Timestamps">
        <DataList>
          <DataRow label="createTimestamp" value={formatTimestamp(quote.createTimestamp)} />
          <DataRow label="statusModifyTimestamp" value={formatTimestamp(quote.statusModifyTimestamp)} />
          <DataRow label="deadline" value={formatTimestamp(quote.deadline)} />
        </DataList>
      </Section>

      <Section title="Misc">
        <DataList>
          <DataRow
            label="data"
            value={quote.data === "0x" ? undefined : formatHex(quote.data)}
            copyValue={quote.data === "0x" ? undefined : quote.data}
            mono
          />
        </DataList>
      </Section>

      <QuotePriceHistorySection quoteId={quote.id} />

      <QuoteTpSlSection quoteId={quote.id} subAccount={quote.partyA} />
    </div>
  );
}

function QuoteTpSlSection({ quoteId, subAccount }: { quoteId: bigint; subAccount: Address }) {
  const tpsl = useQuoteTpSl({ quoteId, account: subAccount });
  return (
    <Section title="TP/SL">
      {tpsl.isLoading ? (
        <span className="text-muted-foreground text-xs">Loading…</span>
      ) : tpsl.error ? (
        <span className="text-destructive text-xs">{tpsl.error.message}</span>
      ) : tpsl.data ? (
        <DataList>
          <DataRow label="tp" value={tpsl.data.tp || "—"} mono />
          <DataRow label="sl" value={tpsl.data.sl || "—"} mono />
          <DataRow label="tpPriceType" value={tpsl.data.tpPriceType} mono />
          <DataRow label="slPriceType" value={tpsl.data.slPriceType} mono />
          <DataRow label="tpOpenPrice" value={tpsl.data.tpOpenPrice || "—"} mono />
          <DataRow label="slOpenPrice" value={tpsl.data.slOpenPrice || "—"} mono />
          <DataRow label="tpCohQuoteId" value={tpsl.data.tpCohQuoteId ?? "—"} mono />
          <DataRow label="slCohQuoteId" value={tpsl.data.slCohQuoteId ?? "—"} mono />
        </DataList>
      ) : (
        <span className="text-muted-foreground text-xs">No data.</span>
      )}
    </Section>
  );
}

function QuotePriceHistorySection({ quoteId }: { quoteId: bigint }) {
  const priceHistory = useQuotePriceHistory({ quoteId });
  return (
    <Section title="Price History">
      <QuoteEventsList
        rows={priceHistory.data?.rows}
        isLoading={priceHistory.isLoading}
        hasMore={priceHistory.data?.hasMore}
      />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground/80 border-border border-b pb-1 text-[0.65rem] font-medium tracking-wider uppercase">
        {title}
      </span>
      {children}
    </div>
  );
}

function WhitelistValue({ list }: { list: readonly Address[] }) {
  if (list.length === 0) return <span className="text-muted-foreground">any</span>;
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {list.map((address) => (
        <AddressTag key={address} address={address} chars={4} />
      ))}
    </span>
  );
}
