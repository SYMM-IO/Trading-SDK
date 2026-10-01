"use client";
import { WEI_DECIMALS } from "@/lib/format";
import { PositionType, type UnifiedQuote } from "@symmio/trading-core";
import { useQuoteTpSl, useQuoteUpnlAndPnl } from "@symmio/trading-react";
import { cn } from "@symmio/ui/lib/utils";
import { formatRelativeTimestamp } from "@symmio/utils";
import { parseUnits } from "viem";
import {
  EMPTY,
  formatFixedPoint,
  formatLeverageLabel,
  formatSigned,
  quoteCreatedSeconds,
  quoteIdLabel,
  signedToneClassName,
} from "./quote-format";
import { buildJourney, remainingJourneyLabels } from "./quote-journey";
import { quoteShape } from "./quote-shape";
import { quoteState, stateDotClassName } from "./quote-state";
import type { MarketDisplay } from "./use-market-display";

/** One WAD — the 18-decimal fixed-point scale every quote amount is quoted in. */
const WAD = 10n ** BigInt(WEI_DECIMALS);

/** Relative age without the trailing "ago" — a card has no room for a word it can imply. */
function formatAge(seconds?: bigint): string {
  if (seconds === undefined) return EMPTY;
  return formatRelativeTimestamp(seconds, { formatPast: (duration) => duration, unsetLabel: EMPTY });
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

interface Props {
  quote: UnifiedQuote;
  /** Name and decimal precisions for this quote's market. */
  market: MarketDisplay;
  /** Open this quote's detail. */
  onOpen: () => void;
}

/**
 * One quote as a self-contained card, for any container too narrow to hold the
 * table.
 *
 * Three lines, in priority order: what it is (side, market, leverage, id), what
 * it is worth (size, notional, and either P&L or the price it is waiting at),
 * and what it is doing (prices, state, age). Nothing is laid out in tracks, so
 * the card cannot overflow sideways at any width.
 *
 * Lines two and three switch on {@link quoteShape}, because the three kinds of
 * quote carry different facts: a resting order has no fill, so it has no entry
 * price and no unrealized P&L, and an in-flight quote has no on-chain id. Running
 * all three through one template is what prints a confident `$0.00` beside an
 * entry price that was never traded at.
 */
export function QuoteCard({ quote, market, onOpen }: Props) {
  const shape = quoteShape(quote);
  const state = quoteState(quote);
  const isLong = quote.positionType === PositionType.LONG;

  const { upnl, upnlPercent, markPrice, leverage, isLoading } = useQuoteUpnlAndPnl({ quote });
  const priced = !isLoading && markPrice !== null;

  const tpslQuoteId = quote.quoteId ?? (quote.tempQuoteId !== undefined ? BigInt(quote.tempQuoteId) : undefined);
  const tpsl = useQuoteTpSl({
    quoteId: tpslQuoteId ?? 0n,
    account: quote.partyA,
    query: { enabled: tpslQuoteId !== undefined && tpslQuoteId !== 0n },
  });
  const hasTp = Boolean(tpsl.data?.tp) || tpsl.data?.tpState === "confirming";
  const hasSl = Boolean(tpsl.data?.sl) || tpsl.data?.slState === "confirming";

  /**
   * Notional is the position's live worth at mark, but a quote that never filled
   * has no mark to be worth anything at — it is worth what it asked for. Pricing
   * a resting order at mark would report a number the order has not earned.
   */
  const notional =
    shape === "position"
      ? priced
        ? (quote.openQuantity * parseUnits(markPrice, WEI_DECIMALS)) / WAD
        : undefined
      : (quote.openQuantity * quote.requestedOpenPrice) / WAD;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-quote-key={quote.key}
      data-quote-shape={shape}
      className={cn(
        "group border-border/70 bg-card hover:border-border focus-visible:ring-ring flex w-full overflow-hidden rounded-xl border text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
        shape === "in-flight" && "border-primary/35",
      )}
    >
      <span className={cn("w-[3px] shrink-0", isLong ? "bg-positive" : "bg-negative")} aria-hidden />

      <span className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide",
              isLong ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative",
            )}
          >
            {isLong ? "LONG" : "SHORT"}
          </span>
          <span className="font-display text-foreground truncate text-sm font-semibold">{market.name}</span>
          <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold">
            {formatLeverageLabel(leverage)}
          </span>
          <span className="flex-1" />
          <span
            className={cn(
              "shrink-0 font-mono text-xs",
              shape === "in-flight" ? "text-primary" : "text-muted-foreground",
            )}
          >
            {quoteIdLabel(quote)}
          </span>
          <span className="text-muted-foreground/60 group-hover:text-muted-foreground shrink-0 transition-colors">
            <ChevronRightIcon />
          </span>
        </span>

        <span className="flex items-end justify-between gap-3">
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-foreground truncate font-mono text-[0.9rem] font-semibold">
              {formatFixedPoint(quote.openQuantity, market.quantityPrecision)}
            </span>
            <span className="text-muted-foreground truncate font-mono text-[0.7rem]">
              {notional === undefined ? EMPTY : `$${formatFixedPoint(notional, 2)}`} notional
            </span>
          </span>

          {shape === "position" ? (
            <span className="flex shrink-0 flex-col items-end leading-tight">
              <span className={cn("font-mono text-[0.9rem] font-semibold", signedToneClassName(priced ? upnl : "0"))}>
                {priced ? formatSigned(upnl) : EMPTY}
              </span>
              <span className={cn("font-mono text-[0.7rem]", signedToneClassName(priced ? upnlPercent : "0"))}>
                {priced && formatSigned(upnlPercent, 2) !== EMPTY ? `${formatSigned(upnlPercent, 2)}%` : EMPTY}
              </span>
            </span>
          ) : (
            <span className="flex shrink-0 flex-col items-end leading-tight">
              <span className="text-foreground font-mono text-[0.9rem] font-semibold">
                {formatFixedPoint(quote.requestedOpenPrice, market.pricePrecision)}
              </span>
              <span className="text-muted-foreground text-[0.7rem]">
                {shape === "resting" ? "limit price" : "requested"}
              </span>
            </span>
          )}
        </span>

        <span className="border-border/50 flex items-center justify-between gap-2 border-t pt-1.5">
          <QuoteCardFootnote quote={quote} market={market} shape={shape} markPrice={priced ? markPrice : null} />

          <span className="flex shrink-0 items-center gap-1.5">
            {hasTp ? <span className="text-positive font-mono text-[0.65rem] font-semibold">TP</span> : null}
            {hasSl ? <span className="text-info font-mono text-[0.65rem] font-semibold">SL</span> : null}
            {shape === "in-flight" ? null : (
              <>
                <span className={cn("size-1.5 shrink-0 rounded-full", stateDotClassName(state.tone))} aria-hidden />
                <span className="text-muted-foreground text-[0.7rem]">{state.label}</span>
              </>
            )}
            <span className="text-muted-foreground/70 font-mono text-[0.7rem]">
              {formatAge(quoteCreatedSeconds(quote))}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

/**
 * The left half of a card's third line — the one part that differs most between
 * the three shapes, so it is worth its own component rather than three ternaries
 * inline.
 */
function QuoteCardFootnote({
  quote,
  market,
  shape,
  markPrice,
}: {
  quote: UnifiedQuote;
  market: MarketDisplay;
  shape: ReturnType<typeof quoteShape>;
  markPrice: string | null;
}) {
  if (shape === "in-flight") {
    const stages = buildJourney(quote, market.pricePrecision, market.quantityPrecision);
    const remaining = remainingJourneyLabels(stages);
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          {stages.map((stage, index) => (
            <span
              key={stage.key}
              className={cn(
                "size-1.5 rounded-full",
                index === stages.length - 1 ? "bg-primary" : "bg-muted-foreground/50",
              )}
            />
          ))}
          {remaining.map((label) => (
            <span key={label} className="border-border size-1.5 rounded-full border" />
          ))}
        </span>
        <span className="text-primary truncate text-[0.7rem]">{quoteState(quote).label}</span>
      </span>
    );
  }

  if (shape === "resting") {
    const deadline = quote.deadline;
    return (
      <span className="text-muted-foreground min-w-0 truncate font-mono text-[0.7rem]">
        {deadline === undefined ? (
          `requested ${formatFixedPoint(quote.requestedOpenPrice, market.pricePrecision)}`
        ) : (
          <span className="text-warning">expires {formatRelativeTimestamp(deadline, { unsetLabel: EMPTY })}</span>
        )}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground min-w-0 truncate font-mono text-[0.7rem]">
      entry {formatFixedPoint(quote.openedPrice ?? quote.requestedOpenPrice, market.pricePrecision)}
      {markPrice === null ? "" : ` · mark ${Number(markPrice).toFixed(market.pricePrecision)}`}
    </span>
  );
}
