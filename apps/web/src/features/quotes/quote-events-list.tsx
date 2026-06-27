"use client";

import { DEFAULT_PRICE_PRECISION, DEFAULT_QUANTITY_PRECISION, WEI_DECIMALS } from "@/lib/format";
import { QuoteEventType, type QuoteEventRow } from "@symm-frontier/core";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { formatTokenAmount } from "@symm-frontier/utils";

interface Props {
  rows: QuoteEventRow[] | undefined;
  isLoading: boolean;
  hasMore?: boolean;
  /** Market price precision. */
  pricePrecision?: number;
  /** Market quantity precision. */
  quantityPrecision?: number;
  /** Optional override for the empty-state copy. */
  emptyText?: string;
}

const EMPTY = "—";

function formatWei(value: bigint | undefined, precision: number): string {
  if (value === undefined) return EMPTY;
  return formatTokenAmount(value, WEI_DECIMALS, { maxFractionDigits: precision });
}

function formatSignedWei(value: bigint | undefined, precision: number): string {
  if (value === undefined) return EMPTY;
  if (value === 0n) return "0";
  const sign = value > 0n ? "+" : "-";
  const magnitude = value < 0n ? -value : value;
  return `${sign}${formatTokenAmount(magnitude, WEI_DECIMALS, { maxFractionDigits: precision })}`;
}

function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString();
}

function eventTypeLabel(type: QuoteEventType): string {
  switch (type) {
    case QuoteEventType.SettleUpnl:
      return "Settle uPnL";
    case QuoteEventType.ChargeFundingRate:
      return "Funding rate";
    case QuoteEventType.ChargeAccumulatedFundingFee:
      return "Accumulated funding";
  }
}

function eventTypeToneClass(type: QuoteEventType): string {
  switch (type) {
    case QuoteEventType.SettleUpnl:
      return "bg-primary/10 text-primary";
    case QuoteEventType.ChargeFundingRate:
    case QuoteEventType.ChargeAccumulatedFundingFee:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Unified price-history list: every {@link QuoteEventRow} that touches the open
 * price (explicit settle-uPnL events and funding-rate ticks). Each row shows its
 * timestamp, type badge, prev → new price, plus the relevant funding payload
 * when the event carries one.
 */
export function QuoteEventsList({
  rows,
  isLoading,
  hasMore,
  pricePrecision = DEFAULT_PRICE_PRECISION,
  quantityPrecision = DEFAULT_QUANTITY_PRECISION,
  emptyText,
}: Props) {
  if (isLoading && !rows) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-2 text-xs">
        <Spinner className="size-3" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <p className="text-muted-foreground py-2 text-xs">{emptyText ?? "No price history yet."}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const hasFunding = row.fundingPaid !== undefined || row.fundingReceived !== undefined || row.rate !== undefined;
        return (
          <div key={row.eventId} className="border-border/40 flex flex-col gap-1.5 rounded-md border px-2.5 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[0.6rem] font-medium ${eventTypeToneClass(row.type)}`}>
                {eventTypeLabel(row.type)}
              </span>
              <span className="text-muted-foreground text-[0.65rem]">{formatTimestamp(row.timestamp)}</span>
            </div>

            <div className="grid grid-cols-3 gap-x-3 gap-y-1 font-mono text-[0.7rem]">
              <KV label="Prev price" value={formatWei(row.prevPrice, pricePrecision)} />
              <KV label="New price" value={formatWei(row.newPrice, pricePrecision)} />
              <KV label="Open qty" value={formatWei(row.openQuantity, quantityPrecision)} />
            </div>

            {hasFunding ? (
              <div className="border-border/40 grid grid-cols-3 gap-x-3 gap-y-1 border-t pt-1.5 font-mono text-[0.7rem]">
                <KV label="Paid" value={formatWei(row.fundingPaid, 4)} />
                <KV label="Received" value={formatWei(row.fundingReceived, 4)} />
                <KV label="Rate" value={formatSignedWei(row.rate, 6)} />
              </div>
            ) : null}
          </div>
        );
      })}
      {hasMore ? (
        <p className="text-muted-foreground text-center text-[0.65rem]">More events available — paginate to load.</p>
      ) : null}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-[0.6rem]">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
