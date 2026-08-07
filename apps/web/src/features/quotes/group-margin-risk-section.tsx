"use client";

import { InfoIcon } from "@/components/info-icon";
import { USD_MAX_DECIMALS, WEI_DECIMALS } from "@/lib/format";
import type { MarginRiskMetrics, QuoteGroup } from "@symmio/trading-core";
import { useQuoteGroupMarginRisk } from "@symmio/trading-react";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { cn } from "@symmio/ui/lib/utils";
import { formatTokenAmount } from "@symmio/utils";
import type { ReactNode } from "react";
import { ExpandedRowSection } from "./expanded-row-section";

interface Props {
  /** The grouped position whose margin and liquidation risk to summarise. */
  group: QuoteGroup;
}

const EMPTY = "—";

/** Scale of an 18-decimal fixed-point percent, per 1/100th of a percent. */
const PERCENT_CENTI = 10n ** 16n;

/** Below this share of the cushion the panel switches to the alarm tone. */
const HIGH_RISK_PERCENT = 10n * 10n ** 18n;

/** Collateral figure — same precision as every other dollar value in the app. */
function formatAmount(value: bigint): string {
  return formatTokenAmount(value, WEI_DECIMALS, { maxFractionDigits: USD_MAX_DECIMALS });
}

/** Signed collateral figure, e.g. `+4.21` / `−4.21`. The sign is the point, so it is never dropped. */
function formatSignedAmount(value: bigint): string {
  const sign = value < 0n ? "−" : "+";
  return `${sign}${formatAmount(value < 0n ? -value : value)}`;
}

/** An 18-decimal fixed-point percent as a number, e.g. `101.34`. */
function toPercentNumber(raw: bigint): number {
  return Number(raw / PERCENT_CENTI) / 100;
}

/** An 18-decimal fixed-point percent as a whole number, e.g. `101`. Truncates toward zero. */
function formatPercent(raw?: bigint): string {
  if (raw === undefined) return EMPTY;
  return String(Math.trunc(toPercentNumber(raw)));
}

/** Bar fill, clamped to the track. The underlying figure is deliberately unclamped. */
function barWidth(raw?: bigint): number {
  if (raw === undefined) return 0;
  return Math.min(Math.max(toPercentNumber(raw), 0), 100);
}

/**
 * A label with the formula behind it one hover away. Every figure in this
 * section is derived rather than read straight off a contract, so each one says
 * how it was arrived at.
 */
function FigureLabel({ label, formula }: { label: string; formula: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground/70 inline-flex cursor-help items-center gap-1 text-[0.6rem] font-medium tracking-wider uppercase">
          {label}
          <InfoIcon className="size-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-left font-normal normal-case">{formula}</TooltipContent>
    </Tooltip>
  );
}

/** One figure: its label, the formula behind it, and the value. */
function Figure({
  label,
  formula,
  value,
  emphasis = false,
  tone,
}: {
  label: string;
  formula: ReactNode;
  value: ReactNode;
  /** The headline figure of a derivation renders larger. */
  emphasis?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <FigureLabel label={label} formula={formula} />
      <span
        className={cn(
          "font-mono leading-none",
          emphasis ? "text-xl" : "text-sm",
          tone ?? (emphasis ? "text-foreground" : "text-foreground"),
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** The `=` / `+` between terms — real arithmetic, so it is spelled out rather than implied. */
function Operator({ symbol }: { symbol: string }) {
  return (
    <span aria-hidden className="text-muted-foreground/50 pb-0.5 font-mono text-sm leading-none">
      {symbol}
    </span>
  );
}

/**
 * How much of the account's liquidation cushion is left, as a track plus the two
 * figures that bound it.
 *
 * The bar is the honest part of this panel: a position can look healthy on
 * margin alone and still be one tick from liquidation, and the reverse. The
 * percentage sits at 100 with no unrealized PnL, rises above it in profit, and
 * runs to zero as equity falls to the maintenance margin.
 */
function BufferBar({ metrics, liquidationPrice }: { metrics: MarginRiskMetrics; liquidationPrice: bigint }) {
  const { liquidationBufferPercent: buffer } = metrics;
  const isHighRisk = metrics.isLiquidatable || (buffer !== undefined && buffer < HIGH_RISK_PERCENT);
  /**
   * Green-to-red, not primary-to-destructive: this theme's `primary` and
   * `destructive` are both reds a few degrees of hue apart, so a healthy bar
   * drawn in `primary` is indistinguishable from an alarm. A risk meter has to
   * be readable at a glance or it is worse than no meter.
   */
  const tone = isHighRisk ? "text-negative" : "text-positive";

  return (
    <div className="flex flex-col gap-2">
      {/* Left-aligned stacks, never `justify-between`: this panel lives inside a
          horizontally scrolling table row, so a value pushed to the far edge
          lands off-screen. */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <Figure
          label="Liq. price"
          formula="The mark price at which this account's free collateral is exhausted: (Σ notional ∓ free balance) ÷ Σ open size, where free balance is allocated margin minus locked CVA and LF."
          value={
            liquidationPrice > 0n ? formatTokenAmount(liquidationPrice, WEI_DECIMALS, { maxFractionDigits: 6 }) : EMPTY
          }
        />
        <Figure
          label="Buffer"
          formula="Share of the account's zero-uPnL cushion still intact: Rem. to liq. ÷ (Total margin − Maintenance margin). It sits at 100% when flat, rises above it in profit, and reaches 0% at liquidation."
          value={buffer === undefined ? EMPTY : `${formatPercent(buffer)}%`}
          tone={tone}
        />
        <Figure
          label="Rem. to liq."
          formula="Remaining equity to liquidation = Equity − Maintenance margin. Liquidation starts when this reaches zero."
          value={formatAmount(metrics.remainingToLiquidation)}
          tone={tone}
        />
      </div>

      <div
        className="bg-muted ring-border/60 h-2 max-w-md overflow-hidden rounded-full ring-1 ring-inset"
        role="img"
        aria-label={
          buffer === undefined
            ? "Liquidation buffer unavailable"
            : `${formatPercent(buffer)}% of the liquidation cushion remaining`
        }
      >
        <div
          className={cn("h-full rounded-full transition-[width]", isHighRisk ? "bg-negative" : "bg-positive")}
          style={{ width: `${barWidth(buffer)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Margin and liquidation risk for one grouped position.
 *
 * Reads as three claims, in the order a trader needs them: what the position is
 * worth right now (`Equity = Total margin + Unrealized PnL`), how far that is
 * from being liquidated, and which locked legs make up the margin. Each figure
 * carries its own formula, because none of them is a value read straight off a
 * contract.
 *
 * The three margin legs are unrealized-PnL-independent, so they render as soon
 * as the balance lands — only equity and the buffer wait on the price feed.
 */
export function GroupMarginRiskSection({ group }: Props) {
  const { metrics, upnl, liquidationPrice, isMultiAccount, accounts, isLoading, error } = useQuoteGroupMarginRisk({
    group,
  });

  /** Equity folds in the mark price, so it must not claim a total the feed cannot back yet. */
  const showLive = metrics !== undefined && upnl.isComplete;

  /** The one thing worth saying about the section's state, in priority order. */
  const note =
    error !== null ? (
      <span className="text-destructive text-[0.65rem]">{error.message}</span>
    ) : isLoading ? (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[0.65rem]">
        <Spinner className="size-3" />
        <span>Loading…</span>
      </span>
    ) : metrics?.isLiquidatable ? (
      <span className="text-destructive text-[0.65rem]">Below maintenance margin · liquidatable</span>
    ) : !upnl.isComplete && metrics !== undefined ? (
      <span className="text-muted-foreground text-[0.65rem]">Awaiting mark price</span>
    ) : null;

  return (
    <ExpandedRowSection title="Margin & risk" note={note} bodyClassName="flex flex-col gap-4">
      {/* Every figure stays left-aligned: the expanded row spans a horizontally
          scrolling table, so anything pushed to the far edge lands off-screen. */}
      {isMultiAccount ? (
        /**
         * Each Virtual Account is liquidated on its own, so one blended buffer
         * would read as safe while one of them is about to go. Say so instead.
         */
        <p className="text-muted-foreground max-w-lg text-[0.7rem]">
          This position spans {accounts.length} accounts. Margin and liquidation are tracked per account, so there is no
          single figure for the group.
        </p>
      ) : metrics === undefined ? (
        <p className="text-muted-foreground text-[0.7rem]">
          {error !== null ? "Margin unavailable." : "Reading the account's margin…"}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <Figure
              label="Equity"
              formula="Equity = Total margin + Unrealized PnL — what the account backing this position is worth at the current mark price."
              value={showLive ? formatAmount(metrics.equity) : EMPTY}
              emphasis
            />
            <Operator symbol="=" />
            <Figure
              label="Total margin"
              formula="Total margin = the collateral allocated to the Virtual Account backing this position (allocatedBalance)."
              value={formatAmount(metrics.totalMargin)}
            />
            <Operator symbol="+" />
            <Figure
              label="Unrealized PnL"
              formula="Σ across the position's quotes of openQuantity × (mark price − open price), negated for a short. Quotes still awaiting a fill price are excluded."
              value={showLive ? formatSignedAmount(upnl.upnl) : EMPTY}
              tone={upnl.isComplete && upnl.upnl < 0n ? "text-negative" : "text-positive"}
            />
          </div>

          <BufferBar metrics={metrics} liquidationPrice={liquidationPrice} />

          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <Figure
              label="Maintenance margin"
              formula="Maintenance margin = locked CVA + locked LF. Liquidation starts when equity falls to this value."
              value={formatAmount(metrics.maintenanceMargin)}
            />
            <Figure
              label="Initial margin"
              formula="Initial margin = locked partyA MM + maintenance margin — every leg partyA has locked against this position. It shrinks as the position is closed."
              value={formatAmount(metrics.initialMargin)}
            />
          </div>
        </>
      )}
    </ExpandedRowSection>
  );
}
