"use client";

import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { inViewOnce, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@symmio/ui/lib/utils";
import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Explains the core/react split — the architectural spine of the SDK. A stacked
 * diagram reads top-down: your UI sits on `trading-react`, which sits on the
 * framework-agnostic `trading-core`, which sits on the raw protocol. The stack
 * assembles from the top as it scrolls into view.
 */
export function SdkLayers() {
  return (
    <section id="sdk" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:items-center lg:gap-16">
        <Reveal>
          <SectionHeading
            eyebrow="The SDK"
            title={
              <>
                Two layers. One is framework-agnostic <span className="text-primary">on purpose</span>.
              </>
            }
            description="trading-core holds every contract call, GraphQL query, and calculation with no framework assumptions. trading-react is a thin layer of hooks and providers on top. Keep core reusable and a Vue or Solid layer slots in later without a rewrite."
          />

          <ul className="mt-8 flex flex-col gap-4">
            {points.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="bg-primary/10 text-primary ring-primary/15 mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ring-1">
                  <CheckIcon />
                </span>
                <span className="text-muted-foreground text-sm leading-6">
                  <span className="text-foreground font-medium">{point.title}</span> — {point.body}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
          className="flex flex-col items-stretch"
        >
          <LayerCard
            variant="ghost"
            title="Your UI"
            subtitle="apps/web, or your own product"
            trailing={
              <div className="flex flex-wrap gap-1.5">
                <FrameworkChip label="React" state="ready" />
                <FrameworkChip label="Vue" state="soon" />
                <FrameworkChip label="Solid" state="soon" />
              </div>
            }
          />
          <Connector />
          <LayerCard
            variant="accent"
            badge="@symmio/trading-react"
            title="React layer"
            subtitle="Hooks · Providers · Stateful flows"
          />
          <Connector />
          <LayerCard
            variant="primary"
            badge="@symmio/trading-core"
            title="Framework-agnostic core"
            subtitle="Contract calls · GraphQL · Calculations · Transforms"
          />
          <Connector />
          <LayerCard variant="ghost" title="SYMMIO protocol" subtitle="Contracts · Solvers · Enigma prices · Muon" />
        </motion.div>
      </div>
    </section>
  );
}

const points = [
  { title: "Correct by construction", body: "typed errors, validation, and calculations live once, in core." },
  { title: "Reusable everywhere", body: "no React in core means the next framework layer is additive." },
  { title: "Thin React ergonomics", body: "trading-react only adds what genuinely needs component state." },
];

type LayerVariant = "ghost" | "accent" | "primary";

function LayerCard({
  variant,
  badge,
  title,
  subtitle,
  trailing,
}: {
  variant: LayerVariant;
  badge?: string;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border px-5 py-4",
        variant === "ghost" && "border-border/70 border-dashed bg-transparent",
        variant === "accent" && "border-border/70 bg-card/70 shadow-sm backdrop-blur-sm",
        variant === "primary" &&
          "border-primary/30 from-primary/12 ring-primary/10 bg-gradient-to-br to-transparent shadow-md ring-1",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        {badge ? <span className="text-primary font-mono text-xs">{badge}</span> : null}
        <span className="text-foreground font-display text-sm font-semibold tracking-tight">{title}</span>
        <span className="text-muted-foreground truncate text-xs">{subtitle}</span>
      </div>
      {trailing}
    </motion.div>
  );
}

function FrameworkChip({ label, state }: { label: string; state: "ready" | "soon" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        state === "ready"
          ? "border-positive/30 bg-positive/10 text-positive"
          : "border-border/70 bg-muted/40 text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", state === "ready" ? "bg-positive" : "bg-muted-foreground/50")} />
      {label}
      {state === "soon" ? <span className="opacity-70">soon</span> : null}
    </span>
  );
}

function Connector() {
  return <div className="dotted-line mx-auto h-6 w-px" aria-hidden />;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
