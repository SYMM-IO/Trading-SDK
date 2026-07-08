"use client";

import { cn } from "@symmio/ui/lib/utils";

type Tone = "primary" | "positive" | "violet" | "warning";

interface Block {
  name: string;
  tone: Tone;
  /** Highlighted because the hero snippet composes this one. */
  used?: boolean;
}

const blocks: Block[] = [
  { name: "useMarket", tone: "primary", used: true },
  { name: "usePositions", tone: "positive", used: true },
  { name: "useAccount", tone: "violet", used: true },
  { name: "usePrices", tone: "primary" },
  { name: "useQuotes", tone: "warning" },
  { name: "useDeposit", tone: "positive" },
  { name: "useOrders", tone: "violet" },
  { name: "useMuon", tone: "primary" },
  { name: "useBalances", tone: "warning" },
];

const dotColor: Record<Tone, string> = {
  primary: "bg-primary",
  positive: "bg-positive",
  violet: "bg-chart-5",
  warning: "bg-warning",
};

/**
 * "Build anything" example — the closer. The other slides render specific
 * surfaces; this one shows the toolkit behind them: every hook is a building
 * block, so any UI is just a composition. The three blocks the snippet uses are
 * highlighted; the rest hint at the wider surface. Presentational.
 */
export function ComposePanel() {
  return (
    <div className="border-border/70 bg-card/80 ring-border/50 relative w-full overflow-hidden rounded-2xl border shadow-xl ring-1 backdrop-blur-md">
      <div
        className="from-chart-5/14 pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="bg-chart-5/15 text-chart-5 ring-chart-5/20 grid size-9 place-items-center rounded-xl ring-1">
            <BlocksGlyph />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground font-display text-sm font-semibold tracking-tight">Building blocks</span>
            <span className="text-muted-foreground font-mono text-[11px]">trading-react</span>
          </div>
        </div>
        <span className="border-chart-5/30 bg-chart-5/10 text-chart-5 inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[10px] font-medium whitespace-nowrap">
          40+ hooks
        </span>
      </div>

      <p className="text-muted-foreground relative mt-4 px-5 text-xs leading-5">
        Mix any hooks into your own components — no fixed component set.
      </p>

      <div className="relative mt-3 flex flex-wrap gap-1.5 px-5">
        {blocks.map((block) => (
          <span
            key={block.name}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors",
              block.used
                ? "border-chart-5/40 bg-chart-5/10 text-foreground"
                : "border-border/70 bg-muted/30 text-muted-foreground",
            )}
          >
            <span className={cn("size-1.5 rounded-full", dotColor[block.tone])} aria-hidden />
            {block.name}
          </span>
        ))}
        <span className="border-border/70 text-muted-foreground inline-flex items-center gap-1 rounded-lg border border-dashed px-2 py-1 font-mono text-[11px]">
          + 30 more
        </span>
      </div>

      <div className="border-border/60 bg-muted/20 relative mt-5 flex items-center justify-between gap-3 border-t px-5 py-3.5">
        <span className="text-muted-foreground text-[11px]">Your components</span>
        <span className="text-chart-5 inline-flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap">
          Compose your own
          <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}

function BlocksGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
      <path d="M17 14.5v6M14 17.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
