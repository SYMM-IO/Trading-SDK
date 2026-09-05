"use client";

import { WEI_DECIMALS } from "@/lib/format";
import type { GroupTpSlChild, GroupTpSlDesiredMap, GroupTpSlSideKey } from "@symmio/trading-core";
import { childNotional } from "@symmio/trading-react";
import { cn } from "@symmio/ui/lib/utils";
import { formatTokenAmount } from "@symmio/utils";

interface Props {
  /** The group's position legs, in display order. */
  legs: readonly GroupTpSlChild[];
  /** Which side to draw. */
  side: GroupTpSlSideKey;
  /** Pending edits, so the bar moves as the trader types. */
  overrides?: GroupTpSlDesiredMap;
  /** Thinner track for the table cell. */
  compact?: boolean;
}

/**
 * Notional-weighted protection bar for a merged position.
 *
 * Every leg gets a segment sized by its share of the group's open notional, and
 * a segment is filled when that leg carries a trigger. A single percentage would
 * hide the fact that one large unprotected leg matters far more than three small
 * protected ones — this makes that visible at a glance.
 *
 * Shared by the table cell and the exit rail so both read the same way.
 */
export function GroupTpSlCoverageBar({ legs, side, overrides, compact = false }: Props) {
  const total = legs.reduce((sum, leg) => sum + childNotional(leg), 0n);
  /** Success for the profit side, info for the stop — red is reserved for rejected input. */
  const tone = side === "tp" ? "bg-positive" : "bg-info";
  const height = compact ? "h-1" : "h-1.5";

  if (total <= 0n) return <span className={cn("bg-muted dark:bg-muted/40 flex-1 rounded-full", height)} aria-hidden />;

  return (
    <span
      className={cn(
        "bg-muted dark:bg-muted/40 ring-border dark:ring-border/50 flex flex-1 overflow-hidden rounded-full ring-1 ring-inset",
        height,
      )}
      role="img"
      aria-label={`${side === "tp" ? "Take profit" : "Stop loss"} coverage by position size`}
    >
      {legs.map((leg) => {
        const notional = childNotional(leg);
        const share = Number((notional * 10_000n) / total) / 100;
        const edit = overrides?.[leg.key]?.[side];
        const confirmed = side === "tp" ? leg.tpsl.tp : leg.tpsl.sl;
        const state = side === "tp" ? leg.tpsl.tpState : leg.tpsl.slState;
        const covered = (edit ? edit.triggerPrice.trim() : confirmed).length > 0;
        const pending = state === "pending" || state === "confirming";
        return (
          <span
            key={leg.key}
            title={`${formatTokenAmount(notional, WEI_DECIMALS, { maxFractionDigits: 2 })} · ${covered ? "protected" : "unprotected"}`}
            style={{ width: `${share}%` }}
            className={cn(
              "border-background/70 h-full border-r transition-[width,background-color] duration-200 last:border-r-0 motion-reduce:transition-none",
              covered ? tone : "bg-transparent",
              covered && pending && "animate-pulse opacity-60 motion-reduce:animate-none",
            )}
          />
        );
      })}
    </span>
  );
}

/** Render an 18-decimal fixed-point percent as a whole number, e.g. `62`. */
export function formatCoveragePercent(raw?: bigint): string {
  if (raw === undefined) return "0";
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 0 });
}
