"use client";

import { Panel } from "@/components/panel";
import { Pill } from "@/components/pill";
import { Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE, type Deployment, type MarketFamily } from "@/config/deployments";
import { usePrismMode } from "@/features/mode/mode-provider";
import { useFeedStatus } from "@/features/prices/price-provider";
import { formatUsd } from "@/lib/format";
import type { SocketStatus } from "@symmio/trading-core";
import type { PrismMarket } from "./types";

export interface MarketsSummaryProps {
  /** The merged book, before the family chip and search narrow it. */
  markets: readonly PrismMarket[];
  /** True while the book is still loading. */
  isLoading: boolean;
  /** Σ 24h traded value per family, from `useMarketStats`. */
  volume24hOf: (family: MarketFamily) => number | undefined;
}

/**
 * How a price feed's socket state reads to a trader.
 *
 * Deliberately not green/red: on this design system green means LONG and red
 * means SHORT, and a socket has no direction. A healthy feed wears its own
 * family color, a degraded one wears the warning amber.
 */
const FEED_STATUS: Record<SocketStatus, { label: string; tone: "live" | "warn" | "down" }> = {
  open: { label: "Live", tone: "live" },
  connecting: { label: "Connecting", tone: "warn" },
  reconnecting: { label: "Reconnecting", tone: "warn" },
  closing: { label: "Closing", tone: "warn" },
  closed: { label: "Offline", tone: "down" },
};

/**
 * The strip above the merged table: how big the book is, how it splits across
 * solvers, and whether each solver's price feed is actually alive.
 *
 * This is where the multi-solver claim gets audited. Two market counts and two
 * independent socket states, side by side, from one screen — if one feed drops,
 * the strip says so and the other family keeps ticking.
 */
export function MarketsSummary({ markets, isLoading, volume24hOf }: MarketsSummaryProps) {
  const { deployments } = usePrismMode();

  return (
    <Panel className="flex flex-wrap items-stretch gap-x-10 gap-y-5 px-5 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-2xs font-semibold tracking-[0.12em] whitespace-nowrap text-fg-3 uppercase">Markets</span>
        {isLoading && markets.length === 0 ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <Numeric size="2xl" tone="strong">
            {markets.length.toLocaleString("en-US")}
          </Numeric>
        )}
        <span className="text-2xs whitespace-nowrap text-fg-3">
          merged from {deployments.length} {deployments.length === 1 ? "deployment" : "deployments"}
        </span>
      </div>

      {deployments.map((deployment) => (
        <FamilyStat
          key={deployment.family}
          deployment={deployment}
          count={markets.filter((entry) => entry.family === deployment.family).length}
          isLoading={isLoading}
          volume24h={volume24hOf(deployment.family)}
        />
      ))}
    </Panel>
  );
}

interface Props {
  deployment: Deployment;
  count: number;
  isLoading: boolean;
  volume24h?: number;
}

/** One deployment's slice of the book, plus its live feed state. */
function FamilyStat({ deployment, count, isLoading, volume24h }: Props) {
  /* Subscribed, not read: the price store hands out stable accessors, so a
     status indicator has to listen or it would freeze on its first value. */
  const palette = FAMILY_PALETTE[deployment.family];
  const status = FEED_STATUS[useFeedStatus(deployment.family)];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5 text-2xs font-semibold tracking-[0.12em] whitespace-nowrap text-fg-3 uppercase">
        <span aria-hidden className="size-[6px] shrink-0 rounded-full" style={{ background: palette.base }} />
        {deployment.label}
      </span>

      <div className="flex items-center gap-2">
        {isLoading && count === 0 ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <Numeric size="2xl" tone="strong">
            {count.toLocaleString("en-US")}
          </Numeric>
        )}
        <Pill
          dot
          color={status.tone === "live" ? palette.base : status.tone === "warn" ? "var(--warn-500)" : "var(--fg-3)"}
          background={status.tone === "live" ? palette.soft : status.tone === "warn" ? "var(--warn-bg)" : "var(--bg-2)"}
          border={
            status.tone === "live"
              ? palette.border
              : status.tone === "warn"
                ? "var(--warn-bg)"
                : "var(--border-default)"
          }
        >
          {status.label}
        </Pill>
      </div>

      <span className="text-2xs whitespace-nowrap text-fg-3">
        {deployment.solverName} · 24h vol <span className="tnum">{formatUsd(volume24h)}</span>
      </span>
    </div>
  );
}
