"use client";

import { Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import { formatPercent, formatUsd, fromWei } from "@/lib/format";
import type { MarginRiskMetrics } from "@symmio/trading-core";

/** Which liquidation domain a set of metrics describes. */
export type RiskDomain = "account" | "virtual-account";

export interface MarginRiskGaugeProps {
  /** One account's metrics. Never a blend of several — see the note below. */
  metrics?: MarginRiskMetrics;
  isLoading?: boolean;
  /** False when the account has no domain to measure yet — no VA, or nothing funded. */
  hasDomain?: boolean;
}

/**
 * Distance to liquidation for **one** account, as a gauge on the track every
 * other row shares.
 *
 * The SDK is explicit that `calculateMarginRisk` / `useAccountMarginRisk`
 * describe a single liquidation domain and must never be summed across
 * accounts: the totals would add up but the buffer would not, and a blended
 * figure hides an account about to be liquidated behind a comfortable-looking
 * average. So the gauge is mounted once per ledger row, is never handed an
 * aggregate, and the header strip deliberately shows no portfolio-wide risk
 * number — only equity and uPnL, which *are* additive. Drawing every row's
 * gauge on the same track is what makes the accounts comparable at a glance
 * without ever adding them up.
 */
export function MarginRiskGauge({ metrics, isLoading = false, hasDomain = true }: MarginRiskGaugeProps) {
  if (isLoading && !metrics) {
    return (
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-[5px] w-full" />
        <Skeleton className="h-2.5 w-14" />
      </div>
    );
  }

  const reading = readGauge(metrics, hasDomain);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-bg-0">
          <span
            aria-hidden
            className="block h-full rounded-full"
            style={{
              width: `${reading.filled}%`,
              background: `linear-gradient(90deg, ${reading.risk.fill}, ${reading.risk.color})`,
              transition: "width var(--dur-base) var(--ease-out)",
            }}
          />
        </span>
        <Numeric
          size="sm"
          tone={reading.percent === undefined ? "muted" : "strong"}
          className="w-9 shrink-0 text-right"
        >
          {reading.percent === undefined ? "—" : formatPercent(reading.filled, { decimals: 0 })}
        </Numeric>
      </div>
      <span
        className="text-2xs font-semibold tracking-[0.12em] whitespace-nowrap uppercase"
        style={{ color: reading.risk.color }}
      >
        {reading.risk.label}
      </span>
    </div>
  );
}

export interface MarginRiskFiguresProps {
  metrics?: MarginRiskMetrics;
  domain?: RiskDomain;
  hasDomain?: boolean;
}

/** The three figures behind the gauge, for the row's expanded detail. */
export function MarginRiskFigures({ metrics, domain = "account", hasDomain = true }: MarginRiskFiguresProps) {
  if (!hasDomain) {
    return <p className="text-sm text-fg-3">No open position — there is nothing to liquidate yet.</p>;
  }
  if (!metrics) {
    return <p className="text-sm text-fg-3">Margin state unavailable for this account.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col gap-1">
        <Figure label="Mark equity" value={formatUsd(fromWei(metrics.equity), { exact: true })} />
        <Figure label="Maint. margin" value={formatUsd(fromWei(metrics.maintenanceMargin), { exact: true })} />
        <Figure
          label="Buffer left"
          value={formatUsd(fromWei(metrics.remainingToLiquidation), { exact: true })}
          tone={metrics.isLiquidatable ? "short" : "strong"}
        />
      </dl>
      <p className="text-2xs leading-relaxed text-fg-3">
        {domain === "account"
          ? "The whole account is one liquidation domain — every position draws on the same buffer."
          : "Measured on one Virtual Account. Each VA liquidates on its own, so this is never a sum across them."}
      </p>
    </div>
  );
}

function Figure({ label, value, tone = "strong" }: { label: string; value: string; tone?: "strong" | "short" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-fg-2">{label}</dt>
      <dd>
        <Numeric size="sm" tone={tone}>
          {value}
        </Numeric>
      </dd>
    </div>
  );
}

export interface RiskStyle {
  label: string;
  /** Text and the bright end of the fill. */
  color: string;
  /** The dim end of the fill. */
  fill: string;
}

interface GaugeReading {
  /** Raw buffer percentage; `undefined` when there is nothing to measure. */
  percent?: number;
  /** Clamped to the track. */
  filled: number;
  risk: RiskStyle;
}

function readGauge(metrics: MarginRiskMetrics | undefined, hasDomain: boolean): GaugeReading {
  if (!hasDomain) {
    return { filled: 0, risk: { label: "No positions", color: "var(--fg-3)", fill: "var(--bg-4)" } };
  }
  if (!metrics) {
    return { filled: 0, risk: { label: "Unavailable", color: "var(--fg-3)", fill: "var(--bg-4)" } };
  }

  const percent =
    metrics.liquidationBufferPercent === undefined ? undefined : fromWei(metrics.liquidationBufferPercent);
  const filled = percent === undefined ? 0 : Math.min(100, Math.max(0, percent));

  return { percent, filled, risk: riskStyleFor(metrics.isLiquidatable, percent) };
}

/**
 * Colour the gauge by the protocol's own liquidation predicate first.
 *
 * `isLiquidatable` is `remainingToLiquidation < 0` — bit-for-bit the on-chain
 * test — so it outranks the percentage, which is a styling signal and can be
 * `undefined` when the zero-uPnL cushion is not positive.
 */
export function riskStyleFor(isLiquidatable: boolean, bufferPercent?: number): RiskStyle {
  if (isLiquidatable) {
    return { label: "Liquidatable", color: "var(--short-500)", fill: "var(--short-300)" };
  }
  if (bufferPercent === undefined) {
    /* `liquidationBufferPercent` is `undefined` when the zero-uPnL cushion is
       not positive — which means "nothing funded", not "nothing at risk". The
       reassuring wording it used to carry was the opposite of the truth. */
    return { label: "Not funded", color: "var(--fg-3)", fill: "var(--bg-4)" };
  }
  if (bufferPercent < 25) {
    return { label: "Critical", color: "var(--short-500)", fill: "var(--warn-500)" };
  }
  if (bufferPercent < 60) {
    return { label: "Tight", color: "var(--warn-500)", fill: "var(--accent-2)" };
  }
  return { label: "Healthy", color: "var(--long-500)", fill: "var(--accent)" };
}
