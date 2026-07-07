"use client";

import { LiveDot } from "@/components/live-dot";
import { easeOut } from "@/lib/motion";
import { motion } from "motion/react";

/**
 * "Account balance" example — the UI half of the `useAccount` snippet. Shows
 * equity, the collateral split, and the deposit/withdraw actions. Fully
 * presentational; the allocation bar fills in on mount.
 */
export function BalancePanel() {
  return (
    <div className="border-border/70 bg-card/80 ring-border/50 relative w-full overflow-hidden rounded-2xl border shadow-xl ring-1 backdrop-blur-md">
      <div
        className="from-chart-2/12 pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="bg-chart-2/15 text-chart-2 ring-chart-2/20 grid size-9 place-items-center rounded-xl ring-1">
            <WalletIcon />
          </span>
          <div className="flex flex-col">
            <span className="text-foreground font-display text-sm font-semibold tracking-tight">Account</span>
            <span className="text-muted-foreground font-mono text-[11px]">0x8f…2ad1</span>
          </div>
        </div>
        <span className="border-border/70 bg-muted/50 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium">
          <LiveDot tone="positive" className="size-1.5" />
          Settled
        </span>
      </div>

      <div className="relative flex flex-col px-5 pt-4">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Account equity</span>
        <span className="text-foreground font-mono text-2xl font-semibold tracking-tight tabular-nums">
          <span className="text-muted-foreground text-lg">$</span>12,480.55
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl">
        <Stat label="Available" value="$8,214.30" tone="positive" />
        <Stat label="In use" value="$4,266.25" />
      </div>

      <div className="relative mt-4 px-5">
        <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[11px]">
          <span>Allocated</span>
          <span className="font-mono tabular-nums">34%</span>
        </div>
        <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
          <motion.div
            className="from-chart-2/70 to-chart-2 absolute inset-y-0 left-0 rounded-full bg-gradient-to-r"
            initial={{ width: "0%" }}
            animate={{ width: "34%" }}
            transition={{ duration: 1.1, ease: easeOut, delay: 0.6 }}
          />
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 px-5 pb-5">
        <div className="bg-primary text-primary-foreground shadow-primary/25 flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold shadow-lg">
          Deposit
        </div>
        <div className="border-border text-foreground bg-background/40 flex items-center justify-center rounded-xl border py-2.5 text-sm font-semibold">
          Withdraw
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" }) {
  return (
    <div className="bg-muted/40 flex flex-col gap-0.5 px-3 py-2.5">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">{label}</span>
      <span
        className={
          tone === "positive"
            ? "text-positive font-mono text-xs tabular-nums"
            : "text-foreground font-mono text-xs tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17a2 2 0 0 1 2 2v.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="13.5" r="1.5" fill="currentColor" />
    </svg>
  );
}
