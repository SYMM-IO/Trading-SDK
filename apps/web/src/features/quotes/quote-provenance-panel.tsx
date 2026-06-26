import { DEFAULT_PRICE_PRECISION, DEFAULT_QUANTITY_PRECISION, WEI_DECIMALS } from "@/lib/format";
import { OrderType, PositionType, QuoteLifecycle, type UnifiedQuote } from "@symm-frontier/core";
import { useAccountLiquidationPrice, useMarkets, useQuotePlatformFee, useQuoteUpnlAndPnl } from "@symm-frontier/react";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { formatTokenAmount } from "@symm-frontier/utils";
import type { ReactNode } from "react";
import { QuoteLifecycleBadge } from "./quote-lifecycle-badge";

/** Em-dash placeholder for an absent field. */
const EMPTY = "—";

/** Shorten an address to `0x1234…abcd` for dense display; keeps the full value in `title`. */
export function truncateAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** Format an 18-decimal-wei amount with the requested decimal precision. */
function formatFixedPoint(raw: bigint, precision: number): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: precision });
}

/** Format an optional wei amount, falling back to {@link EMPTY}. */
function formatOptionalFixedPoint(raw: bigint | undefined, precision: number): string {
  return raw === undefined ? EMPTY : formatFixedPoint(raw, precision);
}

/** A single node on the provenance rail. */
interface JourneyStage {
  key: string;
  label: string;
  detail?: string;
  tone: "done" | "current" | "failed";
}

/**
 * Build the row's lifecycle journey from EVIDENCE, not a fixed template: a stage
 * appears only once the row demonstrably reached it (an observed temp id, a fill
 * price, an anchored-but-unread id, a confirmed on-chain struct, a close, a
 * failure). The last stage is the current state. This is what makes the
 * optimistic→writing→on-chain story legible.
 */
function buildJourney(quote: UnifiedQuote, pricePrecision: number, quantityPrecision: number): JourneyStage[] {
  const stages: JourneyStage[] = [];
  const observedOrigin = quote.tempQuoteId !== undefined || quote.raw.instantOpen !== undefined;
  if (observedOrigin) {
    stages.push({
      key: "optimistic",
      label: "Optimistic",
      detail: quote.tempQuoteId !== undefined ? `temp #${quote.tempQuoteId}` : undefined,
      tone: "done",
    });
  }
  if (quote.openedPrice !== undefined && quote.openedPrice > 0n) {
    stages.push({
      key: "price",
      label: "Price filled",
      detail: formatFixedPoint(quote.openedPrice, pricePrecision),
      tone: "done",
    });
  }
  if (quote.quoteId !== undefined && quote.raw.onchain === undefined) {
    stages.push({ key: "write-onchain", label: "Writing on-chain", detail: `#${quote.quoteId}`, tone: "done" });
  }
  if (quote.raw.onchain !== undefined) {
    stages.push({
      key: "onchain",
      label: "On-chain",
      detail: quote.quoteId !== undefined ? `#${quote.quoteId}` : undefined,
      tone: "done",
    });
  }
  const closingNow =
    quote.lifecycle === QuoteLifecycle.OPTIMISTIC_CLOSE ||
    quote.lifecycle === QuoteLifecycle.CLOSE_PRICE_FILLED ||
    quote.lifecycle === QuoteLifecycle.WRITE_ONCHAIN_CLOSE ||
    quote.lifecycle === QuoteLifecycle.CLOSING;
  if (closingNow) {
    stages.push({
      key: "close-requested",
      label: "Close requested",
      detail:
        quote.quantityToClose !== undefined ? formatFixedPoint(quote.quantityToClose, quantityPrecision) : undefined,
      tone: "done",
    });
    if (quote.avgClosedPrice !== undefined && quote.avgClosedPrice > 0n) {
      stages.push({
        key: "close-price",
        label: "Close price filled",
        detail: formatFixedPoint(quote.avgClosedPrice, pricePrecision),
        tone: "done",
      });
    }
    if (quote.lifecycle === QuoteLifecycle.WRITE_ONCHAIN_CLOSE) {
      stages.push({ key: "write-onchain-close", label: "Closing on-chain", tone: "done" });
    }
    if (quote.lifecycle === QuoteLifecycle.CLOSING) {
      stages.push({ key: "closing", label: "Closing", tone: "done" });
    }
  }
  if (quote.lifecycle === QuoteLifecycle.CLOSED) {
    stages.push({
      key: "closed",
      label: "Closed",
      detail: formatOptionalFixedPoint(quote.avgClosedPrice, pricePrecision),
      tone: "done",
    });
  }
  if (quote.lifecycle === QuoteLifecycle.FAILED) {
    stages.push({ key: "failed", label: "Failed", tone: "failed" });
  }
  if (stages.length === 0) {
    stages.push({ key: "onchain", label: "On-chain", tone: "current" });
  }
  const last = stages[stages.length - 1];
  if (last && last.tone === "done") last.tone = "current";
  return stages;
}

/** Dot styling per journey-stage tone. */
function dotClassName(tone: JourneyStage["tone"]): string {
  switch (tone) {
    case "current":
      return "bg-primary ring-primary/20 ring-4";
    case "failed":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

/** Horizontal evidence rail of the stages the quote has passed through. */
function JourneyRail({ stages }: { stages: JourneyStage[] }) {
  return (
    <div className="flex items-start">
      {stages.map((stage, index) => (
        <div key={stage.key} className={index < stages.length - 1 ? "flex flex-1 items-start" : "flex items-start"}>
          <div className="flex flex-col items-start gap-1.5">
            <span className={`size-2.5 rounded-full ${dotClassName(stage.tone)}`} aria-hidden />
            <div className="flex flex-col leading-tight">
              <span className="text-foreground text-xs font-medium">{stage.label}</span>
              {stage.detail ? (
                <span className="text-muted-foreground font-mono text-[0.7rem]">{stage.detail}</span>
              ) : null}
            </div>
          </div>
          {index < stages.length - 1 ? <span className="bg-border mt-[4px] h-px flex-1 translate-y-px" /> : null}
        </div>
      ))}
    </div>
  );
}

/** One label/value pair inside a {@link DetailSection}. */
function DetailRow({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground text-[0.7rem]">{label}</span>
      <span className="text-foreground font-mono text-xs" title={title}>
        {value}
      </span>
    </div>
  );
}

/** A titled group of detail rows. */
function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground/80 border-border mb-0.5 border-b pb-1 text-[0.65rem] font-medium tracking-wider uppercase">
        {title}
      </span>
      {children}
    </div>
  );
}

interface Props {
  quote: UnifiedQuote;
}

/**
 * Expanded detail panel for one {@link UnifiedQuote}: an evidence-based journey
 * rail (optimistic → price-filled → on-chain → closing/closed, or failed) over a
 * dense identity / prices / size / margin grid. Surfaces the temp ↔ on-chain id
 * linkage and the Virtual Account a lowcap position anchored under, so a row that
 * started off-chain and is "now on-chain" tells that story when expanded.
 */
export function QuoteProvenancePanel({ quote }: Props) {
  const marketsQuery = useMarkets();
  const market = marketsQuery.data?.find((m) => BigInt(m.symbol_id ?? 0) === quote.symbolId);
  const pricePrecision = market?.price_precision ?? DEFAULT_PRICE_PRECISION;
  const quantityPrecision = market?.quantity_precision ?? DEFAULT_QUANTITY_PRECISION;

  const stages = buildJourney(quote, pricePrecision, quantityPrecision);

  const { upnl, upnlPercent, markPrice, isLoading } = useQuoteUpnlAndPnl({ quote });
  const upnlLoading = isLoading || markPrice === null;

  const { openFee, closeFee } = useQuotePlatformFee({ quote });
  const hasClosed = (quote.closedAmount ?? 0n) > 0n;

  const { liquidationPrice, isLoading: liqLoading } = useAccountLiquidationPrice({ account: quote.partyA });
  return (
    <div className="border-primary/40 flex flex-col gap-4 border-l-2 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-[0.65rem] font-medium tracking-wider uppercase">
          Lifecycle journey
        </span>
        <QuoteLifecycleBadge lifecycle={quote.lifecycle} />
      </div>

      <JourneyRail stages={stages} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        <DetailSection title="Identity">
          <DetailRow label="Quote" value={quote.quoteId !== undefined ? `#${quote.quoteId}` : EMPTY} />
          <DetailRow label="Temp" value={quote.tempQuoteId !== undefined ? `#${quote.tempQuoteId}` : EMPTY} />
          <DetailRow
            label="VA"
            value={quote.vaAddress ? truncateAddress(quote.vaAddress) : EMPTY}
            title={quote.vaAddress}
          />
          <DetailRow label="PartyB" value={quote.partyB ? truncateAddress(quote.partyB) : EMPTY} title={quote.partyB} />
        </DetailSection>

        <DetailSection title="Prices">
          <DetailRow label="Requested" value={formatFixedPoint(quote.requestedOpenPrice, pricePrecision)} />
          <DetailRow label="Opened" value={formatOptionalFixedPoint(quote.openedPrice, pricePrecision)} />
          <DetailRow label="Closed" value={formatOptionalFixedPoint(quote.avgClosedPrice, pricePrecision)} />
          <DetailRow
            label="Liquidation"
            value={
              liqLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3" />
                  <span className="text-muted-foreground">Loading…</span>
                </span>
              ) : liquidationPrice === 0n ? (
                EMPTY
              ) : (
                formatFixedPoint(liquidationPrice, pricePrecision)
              )
            }
          />
        </DetailSection>

        <DetailSection title="Size">
          <DetailRow label="Quantity" value={formatFixedPoint(quote.quantity, quantityPrecision)} />
          <DetailRow label="Open" value={formatFixedPoint(quote.openQuantity, quantityPrecision)} />
          <DetailRow label="Closed" value={formatOptionalFixedPoint(quote.closedAmount, quantityPrecision)} />
          <DetailRow label="To close" value={formatOptionalFixedPoint(quote.quantityToClose, quantityPrecision)} />
        </DetailSection>

        <DetailSection title="Margin · Side">
          <DetailRow label="CVA" value={formatFixedPoint(quote.lockedValues.cva, pricePrecision)} />
          <DetailRow label="LF" value={formatFixedPoint(quote.lockedValues.lf, pricePrecision)} />
          <DetailRow label="Side" value={PositionType[quote.positionType] ?? String(quote.positionType)} />
          <DetailRow label="Order" value={OrderType[quote.orderType] ?? String(quote.orderType)} />
        </DetailSection>

        <DetailSection title="PNL">
          <DetailRow
            label="UPNL"
            value={
              upnlLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3" />
                  <span className="text-muted-foreground">Loading…</span>
                </span>
              ) : (
                formatPnl(upnl, upnlPercent)
              )
            }
          />
        </DetailSection>

        <DetailSection title="Platform fees">
          <DetailRow label="Open" value={formatFee(openFee)} />
          {hasClosed ? <DetailRow label="Close" value={formatFee(closeFee)} /> : null}
        </DetailSection>
      </div>
    </div>
  );
}

function formatPnl(value: string, percent: string): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return EMPTY;
  const sign = num > 0 ? "+" : "";
  const fixed = `${sign}${num.toFixed(4)}`;
  return percent === "0" ? fixed : `${fixed} (${sign}${percent}%)`;
}

function formatFee(value: bigint): string {
  if (value === 0n) return EMPTY;
  return formatTokenAmount(value, WEI_DECIMALS, { maxFractionDigits: 4 });
}
