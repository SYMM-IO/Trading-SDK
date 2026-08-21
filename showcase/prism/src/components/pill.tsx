import { FAMILY_PALETTE, getDeployment, type MarketFamily } from "@/config/deployments";
import { cn } from "@/lib/cn";
import type { CSSProperties, ReactNode } from "react";

/**
 * The geometry every chip in the app shares.
 *
 * `leading-none` is load-bearing. A chip that sets no line-height of its own
 * inherits `normal` and resolves it against its own font — about 13px of line
 * box around 7px of cap — and the padding then stacks on top of leading the
 * chip never asked for, so the same label rendered next to a heading and inside
 * a table row came out two different heights. Pinning the line box to the glyph
 * makes a chip exactly its text plus its padding, everywhere.
 */
export const PILL_SHAPE = cn(
  "inline-flex items-center gap-[5px] rounded-full border px-2 py-[3px]",
  "font-mono text-2xs leading-none font-semibold tracking-[0.12em] whitespace-nowrap uppercase",
);

/**
 * A chip's label.
 *
 * Mega tracking adds its 0.12em *after* the last glyph, so an uppercase label
 * in a symmetric box sits visibly left of centre — the wider the tracking, the
 * worse the lean. Pulling the trailing space back off the end re-centres the
 * text over the box.
 */
export function PillLabel({ children }: { children: ReactNode }) {
  return <span className="-me-[0.12em]">{children}</span>;
}

/** A chip's status dot. Follows the chip's own color unless given one. */
export function PillDot({ color }: { color?: string }) {
  return (
    <span aria-hidden className="size-[5px] shrink-0 rounded-full" style={{ background: color ?? "currentColor" }} />
  );
}

export interface PillProps {
  children: ReactNode;
  /** Resolved color for text and dot. */
  color?: string;
  /** Resolved background. */
  background?: string;
  /** Resolved border color. */
  border?: string;
  /** Show a leading dot in the pill color. */
  dot?: boolean;
  className?: string;
}

/** Monospace uppercase pill. The base for solver, chain and lifecycle chips. */
export function Pill({ children, color, background, border, dot = false, className }: PillProps) {
  const style: CSSProperties = {
    color: color ?? "var(--fg-2)",
    background: background ?? "var(--bg-2)",
    borderColor: border ?? "var(--border-default)",
  };

  return (
    <span style={style} className={cn(PILL_SHAPE, className)}>
      {dot ? <PillDot /> : null}
      <PillLabel>{children}</PillLabel>
    </span>
  );
}

export interface SolverPillProps {
  family: MarketFamily;
  /** Show the solver's product name instead of its tag. */
  variant?: "tag" | "name";
  className?: string;
}

/** Solver pills carry the market palette — never the accent. */
export function SolverPill({ family, variant = "tag", className }: SolverPillProps) {
  const deployment = getDeployment(family);
  const palette = FAMILY_PALETTE[family];

  return (
    <Pill dot color={palette.base} background={palette.soft} border={palette.border} className={className}>
      {variant === "tag" ? deployment.solverTag : deployment.solverName}
    </Pill>
  );
}

export interface ChainPillProps {
  family: MarketFamily;
  className?: string;
}

/** Chain pills use the chain's own brand hex and nothing else. */
export function ChainPill({ family, className }: ChainPillProps) {
  const deployment = getDeployment(family);

  return (
    <span className={cn(PILL_SHAPE, "border-line bg-bg-2 text-fg-2", className)}>
      <PillDot color={`var(${deployment.chainColorVar})`} />
      <PillLabel>{deployment.chainName}</PillLabel>
    </span>
  );
}
