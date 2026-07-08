"use client";

import { LiveDot } from "@/components/live-dot";
import { easeOut } from "@/lib/motion";
import { cn } from "@symmio/ui/lib/utils";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * "Order ticket" example — the UI half of the `useMarket` snippet. Fully
 * presentational: the price ticks off a fixed delta cycle (no network, no
 * randomness at render, so SSR and hydration agree) and every control is
 * display-only.
 */
export function OrderTicketPanel() {
  const price = useTickingPrice(63214.2);

  return (
    <div className="border-border/70 bg-card/80 ring-border/50 relative w-full overflow-hidden rounded-2xl border shadow-xl ring-1 backdrop-blur-md">
      <div
        className="from-primary/12 pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="bg-primary/15 text-primary ring-primary/20 grid size-9 place-items-center rounded-xl text-xs font-semibold ring-1">
            ₿
          </span>
          <div className="flex flex-col">
            <span className="text-foreground font-display text-sm font-semibold tracking-tight">BTC-PERP</span>
            <span className="text-muted-foreground text-[11px]">Bitcoin Perpetual</span>
          </div>
        </div>
        <span className="border-border/70 bg-muted/50 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium">
          <LiveDot tone="positive" className="size-1.5" />
          HyperEVM
        </span>
      </div>

      <div className="relative flex items-end justify-between gap-2 px-5 pt-4">
        <div className="flex flex-col">
          <span className="text-foreground font-mono text-2xl font-semibold tracking-tight tabular-nums">
            <span className="text-muted-foreground text-lg">$</span>
            {price.display}
          </span>
          <span className="text-positive mt-0.5 inline-flex items-center gap-1 text-xs font-medium">
            <ArrowUp />
            +2.14% · 24h
          </span>
        </div>
        <Sparkline />
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl">
        <Stat label="Mark" value={price.display} />
        <Stat label="Funding" value="0.011%" tone="positive" />
        <Stat label="Max lev." value="50×" />
      </div>

      <div className="relative mt-4 flex flex-col gap-3 px-5 pb-5">
        <div className="border-border/70 bg-muted/40 grid grid-cols-2 gap-1 rounded-xl border p-1">
          <span className="bg-positive/15 text-positive rounded-lg py-1.5 text-center text-xs font-semibold">Long</span>
          <span className="text-muted-foreground rounded-lg py-1.5 text-center text-xs font-medium">Short</span>
        </div>

        <div className="border-border/70 bg-background/60 flex items-center justify-between rounded-xl border px-3 py-2.5">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Size</span>
          <span className="text-foreground font-mono text-sm tabular-nums">0.35 BTC</span>
        </div>

        <div className="flex items-center justify-between px-0.5">
          <span className="text-muted-foreground text-[11px]">Leverage</span>
          <span className="text-foreground font-mono text-xs tabular-nums">2.5×</span>
        </div>
        <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
          <motion.div
            className="from-primary/70 to-primary absolute inset-y-0 left-0 rounded-full bg-gradient-to-r"
            initial={{ width: "0%" }}
            animate={{ width: "42%" }}
            transition={{ duration: 1.1, ease: easeOut, delay: 0.9 }}
          />
        </div>

        <div className="bg-primary text-primary-foreground shadow-primary/25 mt-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold shadow-lg">
          Place long order
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" }) {
  return (
    <div className="bg-muted/40 flex flex-col gap-0.5 px-3 py-2.5">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">{label}</span>
      <span className={cn("font-mono text-xs tabular-nums", tone === "positive" ? "text-positive" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

/** Cobalt area sparkline that draws itself in on mount. */
function Sparkline() {
  const width = 132;
  const height = 44;
  const values = [20, 22, 19, 24, 21, 26, 23, 29, 25, 31, 28, 34, 30, 37, 35, 40];
  const { line, area } = buildSparkline(values, width, height);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-[132px]" fill="none" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#spark-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.1 }}
      />
      <motion.path
        d={line}
        stroke="var(--primary)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: easeOut, delay: 0.7 }}
      />
    </svg>
  );
}

/** Map a numeric series to `line` and filled `area` SVG paths within a box. */
function buildSparkline(values: number[], width: number, height: number, pad = 3) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return { line: "", area: "" };
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${last[0].toFixed(2)} ${height} L${first[0].toFixed(2)} ${height} Z`;
  return { line, area };
}

/** Advance a price along a fixed, repeating delta cycle once mounted. */
function useTickingPrice(start: number) {
  const [price, setPrice] = useState(start);

  useEffect(() => {
    const deltas = [12.4, -8.1, 5.6, -3.2, 9.8, -6.4, 14.2, -11.5, 4.3, -2.7];
    let i = 0;
    const id = window.setInterval(() => {
      const delta = deltas[i++ % deltas.length] ?? 0;
      setPrice((prev) => prev + delta);
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

  return {
    value: price,
    display: price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}

function ArrowUp() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="size-3" aria-hidden>
      <path
        d="M6 9.5V2.5M3 5.5 6 2.5l3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
