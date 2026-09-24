"use client";
import { WEI_DECIMALS } from "@/lib/format";
import { PositionType, TpSlInfoState, type UnifiedQuote } from "@symmio/trading-core";
import {
  useAccountLiquidationPrice,
  useQuoteFunding,
  useQuotePendingFunding,
  useQuotePlatformFee,
  useQuotePriceHistory,
  useQuoteTpSl,
  useQuoteUpnlAndPnl,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { CopyButton } from "@symmio/ui/components/copy-button";
import { JsonView } from "@symmio/ui/components/json-view";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { formatRelativeTimestamp, formatTokenAmount } from "@symmio/utils";
import { useState, type ReactNode } from "react";
import { parseUnits } from "viem";
import { DetailRow, QuoteDetailSection } from "./quote-detail-section";
import { QuoteEventsList } from "./quote-events-list";
import {
  EMPTY,
  formatFixedPoint,
  formatLeverageLabel,
  formatOptionalFixedPoint,
  formatSigned,
  quoteIdLabel,
  signedToneClassName,
  truncateAddress,
} from "./quote-format";
import { buildJourney, remainingJourneyLabels } from "./quote-journey";
import { QuoteJourneyRail } from "./quote-journey-rail";
import { quoteShape } from "./quote-shape";
import type { MarketDisplay } from "./use-market-display";

/** One WAD — the 18-decimal fixed-point scale every quote amount is quoted in. */
const WAD = 10n ** BigInt(WEI_DECIMALS);

/** Pending funding grows every epoch and no event announces it, so the panel polls it. */
const PENDING_FUNDING_REFETCH_MS = 60_000;

/** Tooltip on the pending row: what it is, and why it is not part of `Net`. */
const PENDING_FUNDING_TITLE =
  "Accrued since the last settlement and not yet charged. Not part of Net; it settles on the next charge or close.";

function Loading() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Spinner className="size-3" />
      <span className="text-muted-foreground">Loading…</span>
    </span>
  );
}

function BackIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function formatFee(value: bigint): string {
  if (value === 0n) return EMPTY;
  return formatTokenAmount(value, WEI_DECIMALS, { maxFractionDigits: 4 });
}

/** Signed funding, income-positive like the SDK returns it: `+` earned, `-` paid. */
function formatSignedFee(value: bigint, zeroLabel: string): string {
  if (value === 0n) return zeroLabel;
  const magnitude = value < 0n ? -value : value;
  return `${value > 0n ? "+" : "-"}${formatTokenAmount(magnitude, WEI_DECIMALS, { maxFractionDigits: 4 })}`;
}

function renderFunding(value: bigint | undefined, isLoading: boolean, hasQuoteId: boolean, signed = false): ReactNode {
  if (!hasQuoteId) return EMPTY;
  if (value === undefined) return isLoading ? <Loading /> : EMPTY;
  return signed ? formatSignedFee(value, EMPTY) : formatFee(value);
}

/**
 * Pending funding, income-positive like {@link renderFunding} — except a resolved
 * `0n` prints `0` rather than the em dash. On a pair that does not run accumulated
 * funding every active position reads exactly zero, and that is an answer, not a
 * missing value.
 */
function renderPendingFunding(value: bigint | undefined, isLoading: boolean): ReactNode {
  if (value === undefined) return isLoading ? <Loading /> : EMPTY;
  return formatSignedFee(value, "0");
}

/**
 * Render one TP or SL row: the trigger price with its priceType hint plus a state
 * badge. Empty snapshot → em-dash.
 */
function TpSlRowValue({
  price,
  priceType,
  state,
}: {
  price?: string;
  priceType?: "markPrice" | "lastPrice";
  state?: TpSlInfoState;
}) {
  if (state === "confirming") {
    return (
      <span className="inline-flex items-center gap-1.5">
        {price ? <span className="font-mono">{price}</span> : null}
        <Badge variant="warning">Processing…</Badge>
      </span>
    );
  }
  if (!price) return <>{EMPTY}</>;
  const badge =
    state === "triggered" ? (
      <Badge variant="info">Triggered</Badge>
    ) : state === "pending" ? (
      <Badge variant="secondary">Pending</Badge>
    ) : null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono">{price}</span>
      <span className="text-muted-foreground text-[0.65rem]">({priceType === "lastPrice" ? "last" : "mark"})</span>
      {badge}
    </span>
  );
}

/** An address row with a copy affordance — a truncated address you cannot copy is a dead end. */
function AddressRow({ label, address }: { label: string; address?: string }) {
  if (!address) return <DetailRow label={label} value={EMPTY} />;
  return (
    <DetailRow
      label={label}
      title={address}
      value={
        <span className="inline-flex items-center gap-1">
          {truncateAddress(address)}
          <CopyButton value={address} aria-label={`Copy ${label} address`} className="size-4" />
        </span>
      }
    />
  );
}

interface Props {
  quote: UnifiedQuote;
  /** Name and decimal precisions for this quote's market. */
  market: MarketDisplay;
  /**
   * `drill-in` — the panel has taken over a narrow column: it gets a header with
   * a way back, and folds its lower sections because height is scarce.
   * `inline` — the panel is expanded beneath a table row that has room to show
   * everything at once.
   */
  variant?: "drill-in" | "inline";
  /** Return to the list. Required by the `drill-in` variant. */
  onBack?: () => void;
  testId?: string;
}

/**
 * Everything known about one {@link UnifiedQuote}: an evidence-based journey rail
 * over its position, margin, fees, exits, accounts and raw source rows.
 *
 * Section names and their order are identical in both variants, so a reader who
 * learned the panel in the sidebar does not relearn it on the solvers page — only
 * the column count and whether the lower sections start folded change. The grid
 * is measured by `@container/quotes`, never the viewport: the sidebar drags
 * between 360 and 1400px and pops out into its own window, so the window's width
 * says nothing about the space this panel has.
 */
export function QuoteDetailPanel({ quote, market, variant = "inline", onBack, testId }: Props) {
  const { pricePrecision, quantityPrecision } = market;
  const drillIn = variant === "drill-in";
  const shape = quoteShape(quote);
  const isLong = quote.positionType === PositionType.LONG;

  const stages = buildJourney(quote, pricePrecision, quantityPrecision);
  const remaining = remainingJourneyLabels(stages);

  const { upnl, upnlPercent, markPrice, leverage, isLoading } = useQuoteUpnlAndPnl({ quote });
  const priced = !isLoading && markPrice !== null;

  /**
   * A position is worth its open size at mark; a quote that never filled has no
   * mark to be worth anything at, so it is worth what it asked for. Same rule the
   * card uses, so the two never disagree about one quote.
   */
  const notional =
    shape === "position"
      ? priced
        ? (quote.openQuantity * parseUnits(markPrice, WEI_DECIMALS)) / WAD
        : undefined
      : (quote.openQuantity * quote.requestedOpenPrice) / WAD;
  const initialNotional =
    quote.initialOpenedPrice === undefined ? undefined : (quote.quantity * quote.initialOpenedPrice) / WAD;

  const { openFee, closeFee } = useQuotePlatformFee({ quote });
  const hasClosed = (quote.closedAmount ?? 0n) > 0n;

  const { liquidationPrice, isLoading: liqLoading } = useAccountLiquidationPrice({ account: quote.partyA });
  const funding = useQuoteFunding({ quoteId: quote.quoteId });
  const pendingFunding = useQuotePendingFunding({ quote, query: { refetchInterval: PENDING_FUNDING_REFETCH_MS } });
  /**
   * A quote that is not an active position is never read: the hook answers `null`
   * and idle, so the row is left out. Only a read quote can load or fail.
   */
  const showPendingFunding = pendingFunding.data !== null || pendingFunding.isLoading || pendingFunding.error !== null;

  /**
   * Prefer the on-chain id once the quote anchors; fall back to the temp id
   * pre-chain. The store aliases both to the same record via the solver's
   * temp ↔ on-chain link, so this resolves to a single coherent status.
   */
  const tpslQuoteId = quote.quoteId ?? (quote.tempQuoteId !== undefined ? BigInt(quote.tempQuoteId) : undefined);
  const tpsl = useQuoteTpSl({
    quoteId: tpslQuoteId ?? 0n,
    account: quote.partyA,
    query: { enabled: tpslQuoteId !== undefined && tpslQuoteId !== 0n },
  });

  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const priceHistory = useQuotePriceHistory({
    quoteId: quote.quoteId ?? 0n,
    query: { enabled: showPriceHistory && quote.quoteId !== undefined },
  });

  const hasTp = Boolean(tpsl.data?.tp) || tpsl.data?.tpState === "confirming";
  const hasSl = Boolean(tpsl.data?.sl) || tpsl.data?.slState === "confirming";
  const exitsSummary = hasTp && hasSl ? "TP · SL armed" : hasTp ? "TP armed" : hasSl ? "SL armed" : "none set";

  return (
    <div
      className={cn(
        drillIn
          ? "border-border/70 bg-card overflow-hidden rounded-xl border"
          : "border-primary/40 border-l-2 px-4 py-3.5",
      )}
      data-testid={testId}
    >
      {drillIn ? (
        <header className="bg-muted/40 border-border/70 flex items-center gap-2 border-b px-3 py-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to quotes"
            data-testid={testId ? `${testId}-back` : undefined}
            className="border-border/80 text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md border px-1.5 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <BackIcon />
          </button>
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
          <span className="text-foreground shrink-0 font-mono text-xs">{quoteIdLabel(quote)}</span>
          {quote.quoteId !== undefined ? (
            <CopyButton value={quote.quoteId.toString()} aria-label="Copy quote id" className="size-5 shrink-0" />
          ) : null}
        </header>
      ) : null}

      <div className={cn("flex flex-col gap-4", drillIn && "p-3")}>
        <QuoteDetailSection title="Journey" summary={stages[stages.length - 1]?.label}>
          <QuoteJourneyRail stages={stages} remaining={remaining} settled={quote.raw.onchain !== undefined} />
        </QuoteDetailSection>

        <div
          className={cn(
            "gap-3",
            /**
             * Collapsible sections never share a grid row: a grid row is as tall
             * as its tallest cell, so unfolding one section would inflate its
             * neighbour into a tall empty box. The drill-in stacks them and moves
             * the multi-column behaviour inside each section instead, where
             * growing one cannot reach anything else.
             */
            drillIn
              ? "flex flex-col"
              : "grid grid-cols-1 items-start @2xl/quotes:grid-cols-2 @2xl/quotes:gap-x-8 @5xl/quotes:grid-cols-4",
          )}
        >
          <QuoteDetailSection
            title="Position and price"
            rowColumns={drillIn}
            summary={
              shape === "position" && priced ? (
                <span className={signedToneClassName(upnl)}>{formatSigned(upnl)}</span>
              ) : undefined
            }
          >
            <DetailRow label="Open size" value={formatFixedPoint(quote.openQuantity, quantityPrecision)} />
            <DetailRow
              label="Notional"
              value={notional !== undefined ? formatFixedPoint(notional, 2) : isLoading ? <Loading /> : EMPTY}
            />
            <DetailRow label="Requested" value={formatFixedPoint(quote.quantity, quantityPrecision)} />
            <DetailRow label="Initial notional" value={formatOptionalFixedPoint(initialNotional, 2)} />
            <DetailRow label="Closed" value={formatOptionalFixedPoint(quote.closedAmount, quantityPrecision)} />
            <DetailRow label="To close" value={formatOptionalFixedPoint(quote.quantityToClose, quantityPrecision)} />
            <DetailRow label="Entry" value={formatOptionalFixedPoint(quote.openedPrice, pricePrecision)} />
            <DetailRow label="Mark" value={priced ? Number(markPrice).toFixed(pricePrecision) : EMPTY} />
            <DetailRow label="Requested at" value={formatFixedPoint(quote.requestedOpenPrice, pricePrecision)} />
            <DetailRow label="Avg close" value={formatOptionalFixedPoint(quote.avgClosedPrice, pricePrecision)} />
            <DetailRow
              label="Liquidation"
              valueClassName="text-warning"
              value={
                liqLoading ? (
                  <Loading />
                ) : liquidationPrice === 0n ? (
                  EMPTY
                ) : (
                  formatFixedPoint(liquidationPrice, pricePrecision)
                )
              }
            />
          </QuoteDetailSection>

          <QuoteDetailSection
            title="Margin and risk"
            rowColumns={drillIn}
            collapsible={drillIn}
            summary={`cva ${formatFixedPoint(quote.lockedValues.cva, 2)} · lf ${formatFixedPoint(quote.lockedValues.lf, 2)}`}
          >
            <DetailRow label="CVA" value={formatFixedPoint(quote.lockedValues.cva, pricePrecision)} />
            <DetailRow label="Liquidation fee" value={formatFixedPoint(quote.lockedValues.lf, pricePrecision)} />
            <DetailRow label="PartyA MM" value={formatFixedPoint(quote.lockedValues.partyAmm, pricePrecision)} />
            <DetailRow label="PartyB MM" value={formatFixedPoint(quote.lockedValues.partyBmm, pricePrecision)} />
            <DetailRow label="Leverage" value={formatLeverageLabel(leverage)} />
            <DetailRow
              label="Unrealized"
              valueClassName={priced ? signedToneClassName(upnl) : undefined}
              value={isLoading ? <Loading /> : priced ? formatSigned(upnl) : EMPTY}
            />
            <DetailRow
              label="Return"
              valueClassName={priced ? signedToneClassName(upnlPercent) : undefined}
              value={priced && formatSigned(upnlPercent, 2) !== EMPTY ? `${formatSigned(upnlPercent, 2)}%` : EMPTY}
            />
          </QuoteDetailSection>

          <QuoteDetailSection
            title="Fees and funding"
            rowColumns={drillIn}
            collapsible={drillIn}
            summary={funding.data ? `net ${formatSignedFee(funding.data.netReceived, "0")}` : undefined}
          >
            <DetailRow label="Open fee" value={formatFee(openFee)} />
            {hasClosed ? <DetailRow label="Close fee" value={formatFee(closeFee)} /> : null}
            <DetailRow
              label="Funding paid"
              value={renderFunding(funding.data?.paid, funding.isLoading, quote.quoteId !== undefined)}
            />
            <DetailRow
              label="Funding received"
              value={renderFunding(funding.data?.received, funding.isLoading, quote.quoteId !== undefined)}
            />
            <DetailRow
              label="Net"
              value={renderFunding(funding.data?.netReceived, funding.isLoading, quote.quoteId !== undefined, true)}
            />
            {showPendingFunding ? (
              <div className="border-border/60 mt-0.5 border-t border-dashed pt-1.5 @2xl/quotes:col-span-2">
                <DetailRow
                  label="Pending (unsettled)"
                  value={renderPendingFunding(pendingFunding.data?.pendingNetReceived, pendingFunding.isLoading)}
                  title={pendingFunding.error?.message ?? PENDING_FUNDING_TITLE}
                />
              </div>
            ) : null}
            <DetailRow label="Max rate accepted" value={formatOptionalFixedPoint(quote.maxFundingRate, 4)} />
          </QuoteDetailSection>

          <QuoteDetailSection title="Exits" rowColumns={drillIn} collapsible={drillIn} summary={exitsSummary}>
            <DetailRow
              label="Take profit"
              value={
                tpsl.isLoading ? (
                  <Loading />
                ) : (
                  <TpSlRowValue price={tpsl.data?.tp} priceType={tpsl.data?.tpPriceType} state={tpsl.data?.tpState} />
                )
              }
            />
            <DetailRow
              label="Stop loss"
              value={
                tpsl.isLoading ? (
                  <Loading />
                ) : (
                  <TpSlRowValue price={tpsl.data?.sl} priceType={tpsl.data?.slPriceType} state={tpsl.data?.slState} />
                )
              }
            />
          </QuoteDetailSection>

          <QuoteDetailSection
            title="Accounts and timing"
            rowColumns={drillIn}
            collapsible={drillIn}
            summary={quote.vaAddress ? `VA ${truncateAddress(quote.vaAddress)}` : quote.origin}
          >
            <DetailRow label="Quote" value={quote.quoteId !== undefined ? `#${quote.quoteId}` : EMPTY} />
            <DetailRow label="Temp" value={quote.tempQuoteId !== undefined ? `#${quote.tempQuoteId}` : EMPTY} />
            <AddressRow label="Virtual account" address={quote.vaAddress} />
            <AddressRow label="PartyB" address={quote.partyB} />
            <AddressRow label="Affiliate" address={quote.affiliate} />
            <DetailRow
              label="Created"
              value={quote.createTimestamp === undefined ? EMPTY : formatRelativeTimestamp(quote.createTimestamp)}
            />
            <DetailRow
              label="Last change"
              value={
                quote.statusModifyTimestamp === undefined ? EMPTY : formatRelativeTimestamp(quote.statusModifyTimestamp)
              }
            />
            <DetailRow
              label="Deadline"
              value={quote.deadline === undefined ? EMPTY : formatRelativeTimestamp(quote.deadline)}
            />
          </QuoteDetailSection>

          <QuoteDetailSection
            title="Raw response"
            collapsible={drillIn}
            summary={[quote.raw.onchain ? "onchain" : null, quote.raw.instantOpen ? "instantOpen" : null]
              .filter(Boolean)
              .join(" · ")}
          >
            <JsonView
              data={quote.raw}
              defaultExpandedDepth={1}
              scroll={!drillIn}
              className="max-w-full"
              data-testid={testId ? `${testId}-raw` : undefined}
            />
          </QuoteDetailSection>

          {quote.quoteId !== undefined ? (
            <QuoteDetailSection
              title="Price history"
              collapsible
              onOpenChange={(open) => {
                if (open) setShowPriceHistory(true);
              }}
              summary={showPriceHistory ? undefined : "open to load"}
            >
              <QuoteEventsList
                rows={priceHistory.data?.rows}
                isLoading={priceHistory.isLoading}
                hasMore={priceHistory.data?.hasMore}
                pricePrecision={pricePrecision}
                quantityPrecision={quantityPrecision}
              />
            </QuoteDetailSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
