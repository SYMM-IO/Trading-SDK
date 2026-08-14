"use client";

import { DEFAULT_PRICE_PRECISION, DEFAULT_QUANTITY_PRECISION, WEI_DECIMALS } from "@/lib/format";
import { QuoteEventType, type QuoteEventRow } from "@symmio/trading-core";
import { Spinner } from "@symmio/ui/components/spinner";
import { formatTokenAmount } from "@symmio/utils";

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
  /**
   * Show each row's originating quote id. Off by default (a single-quote list
   * would just repeat the same id); turn it on for a merged, group-level
   * timeline, where the rows interleave several children.
   */
  showQuoteId?: boolean;
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
      return "bg-foreground/10 text-foreground/80";
  }
}

/**
 * A labelled figure. `hero` promotes the one value that says what the event
 * actually did — the funding amount on a charge, the price move on a settle.
 */
function Stat({
  label,
  value,
  hero = false,
  toneClassName = "text-foreground",
}: {
  label: string;
  value: React.ReactNode;
  hero?: boolean;
  toneClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Fixed label line so every stat's label sits on the same row, whatever its value size. */}
      <span className="text-muted-foreground text-[0.7rem] leading-none font-medium tracking-wider uppercase">
        {label}
      </span>
      <span className={`font-mono leading-none ${hero ? "text-xl" : "text-sm"} ${toneClassName}`}>{value}</span>
    </div>
  );
}

/** `prev → new` as one figure, because the movement is the fact, not the endpoints. */
function PriceMove({ row, precision, hero = false }: { row: QuoteEventRow; precision: number; hero?: boolean }) {
  return (
    <Stat
      hero={hero}
      label="Open price"
      value={
        <span className="inline-flex items-center gap-2">
          <span className="text-muted-foreground">{formatWei(row.prevPrice, precision)}</span>
          <span className="text-muted-foreground/50" aria-label="changed to">
            →
          </span>
          <span>{formatWei(row.newPrice, precision)}</span>
        </span>
      }
    />
  );
}

/**
 * Unified list of {@link QuoteEventRow}s — settle-uPnL recomputes and funding
 * charges — as one card per event.
 *
 * Each card leads with what the event actually did: the amount settled on a
 * funding charge, the open-price move on a settle-uPnL. A funding charge also
 * nudges the open price, so that move follows as a secondary line rather than
 * competing with the amount.
 */
export function QuoteEventsList({
  rows,
  isLoading,
  hasMore,
  pricePrecision = DEFAULT_PRICE_PRECISION,
  quantityPrecision = DEFAULT_QUANTITY_PRECISION,
  emptyText,
  showQuoteId = false,
}: Props) {
  if (isLoading && !rows) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-3 text-sm">
        <Spinner className="size-4" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <p className="text-muted-foreground py-3 text-sm">{emptyText ?? "No price history yet."}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const paid = row.fundingPaid ?? 0n;
        const received = row.fundingReceived ?? 0n;
        /** Income-positive, matching the SDK's `netReceived`: earned on this tick is `> 0n`. */
        const settled = received - paid;
        const movesFunding = row.fundingPaid !== undefined || row.fundingReceived !== undefined;
        const showsPrice = row.prevPrice !== undefined || row.newPrice !== undefined;

        return (
          <article
            key={row.eventId}
            className="border-border bg-muted/40 flex flex-col gap-3.5 rounded-lg border p-3.5"
          >
            <header className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[0.7rem] font-medium ${eventTypeToneClass(row.type)}`}>
                  {eventTypeLabel(row.type)}
                </span>
                {showQuoteId ? (
                  <span className="text-muted-foreground font-mono text-xs">#{row.quoteId.toString()}</span>
                ) : null}
              </span>
              <time className="text-muted-foreground text-xs">{formatTimestamp(row.timestamp)}</time>
            </header>

            <div className="flex flex-wrap items-start gap-x-8 gap-y-3.5">
              {movesFunding ? (
                <Stat
                  hero
                  label={settled === 0n ? "Funding" : settled > 0n ? "Received" : "Paid"}
                  value={formatWei(settled < 0n ? -settled : settled, 4)}
                  toneClassName={settled > 0n ? "text-primary" : "text-foreground"}
                />
              ) : (
                /** A settle-uPnL moves no money — the price change is what happened. */
                showsPrice && <PriceMove hero row={row} precision={pricePrecision} />
              )}
              {row.rate !== undefined ? <Stat label="Rate" value={formatSignedWei(row.rate, 6)} /> : null}
              {row.openQuantity !== undefined ? (
                <Stat label="Open qty" value={formatWei(row.openQuantity, quantityPrecision)} />
              ) : null}
            </div>

            {movesFunding && showsPrice ? (
              /** Funding also nudges the open price; secondary to the amount charged. */
              <footer className="border-border/60 border-t pt-3">
                <PriceMove row={row} precision={pricePrecision} />
              </footer>
            ) : null}
          </article>
        );
      })}
      {hasMore ? (
        <p className="text-muted-foreground py-1 text-center text-xs">More events available — paginate to load.</p>
      ) : null}
    </div>
  );
}
