"use client";

import { LiveDot } from "@/components/live-dot";
import { cn } from "@symmio/ui/lib/utils";
import { useEffect, useState } from "react";

interface Position {
  symbol: string;
  side: "Long" | "Short";
  leverage: string;
  size: string;
  pnl: number;
  pct: string;
}

const positions: Position[] = [
  { symbol: "BTC-PERP", side: "Long", leverage: "2.5×", size: "0.35 BTC", pnl: 418.02, pct: "+1.9%" },
  { symbol: "HYPE-PERP", side: "Long", leverage: "10×", size: "1,240 HYPE", pnl: 1204.6, pct: "+7.4%" },
  { symbol: "ETH-PERP", side: "Short", leverage: "5×", size: "2.1 ETH", pnl: -62.14, pct: "-0.8%" },
];

/**
 * "Open positions" example — the UI half of the `usePositions` snippet. A
 * compact portfolio table with side, size, and live-*looking* unrealized PnL.
 * Presentational; the net PnL drifts off a fixed delta cycle after mount.
 */
export function PositionsPanel() {
  const total = useDriftingTotal(1560.48);

  return (
    <div className="border-border/70 bg-card/80 ring-border/50 relative w-full overflow-hidden rounded-2xl border shadow-xl ring-1 backdrop-blur-md">
      <div
        className="from-primary/12 pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-display text-sm font-semibold tracking-tight">Open positions</span>
          <span className="bg-primary/15 text-primary rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium">
            {positions.length}
          </span>
        </div>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-medium">
          <LiveDot tone="positive" className="size-1.5" />
          live
        </span>
      </div>

      <ul className="relative mt-4 flex flex-col">
        {positions.map((position) => (
          <li
            key={position.symbol}
            className="border-border/50 flex items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-foreground font-mono text-xs font-medium">{position.symbol}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    position.side === "Long" ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative",
                  )}
                >
                  {position.side} {position.leverage}
                </span>
              </div>
              <span className="text-muted-foreground font-mono text-[11px] tabular-nums">{position.size}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span
                className={cn(
                  "font-mono text-sm font-medium tabular-nums",
                  position.pnl >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {formatSigned(position.pnl)}
              </span>
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  position.pnl >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {position.pct}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-border/60 bg-muted/30 relative flex items-center justify-between border-t px-5 py-3.5">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Net unrealized</span>
        <span className="text-positive font-mono text-sm font-semibold tabular-nums">{total}</span>
      </div>
    </div>
  );
}

/** Format a dollar amount with an explicit sign and two decimals. */
function formatSigned(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Drift a net-PnL figure along a fixed delta cycle after mount. */
function useDriftingTotal(start: number) {
  const [value, setValue] = useState(start);

  useEffect(() => {
    const deltas = [3.4, -1.8, 5.1, -2.2, 4.6, -3.1, 2.7, -1.4];
    let i = 0;
    const id = window.setInterval(() => {
      const delta = deltas[i++ % deltas.length] ?? 0;
      setValue((prev) => prev + delta);
    }, 1600);
    return () => window.clearInterval(id);
  }, []);

  return formatSigned(value);
}
