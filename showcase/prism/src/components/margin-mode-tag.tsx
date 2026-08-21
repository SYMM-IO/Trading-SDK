import { cn } from "@/lib/cn";
import type { CSSProperties } from "react";

export interface MarginModeTagProps {
  /** True when the sub-account pools every position against one balance. */
  crossMargin: boolean;
  /** `short` for the ledger's account cell, `full` where the row has room. */
  variant?: "short" | "full";
  className?: string;
}

const TONES: Record<"cross" | "isolated", CSSProperties> = {
  cross: {
    color: "var(--margin-cross-500)",
    background: "var(--margin-cross-bg)",
    borderColor: "var(--margin-cross-bd)",
  },
  isolated: {
    color: "var(--margin-iso-500)",
    background: "var(--margin-iso-bg)",
    borderColor: "var(--margin-iso-bd)",
  },
};

/**
 * How an account partitions its margin — the one fact about a sub-account that
 * changes what every other figure on its row means.
 *
 * It is colored rather than set in the caption grey it used to be, because the
 * two models are not two flavours of the same thing: on a cross-margin account
 * the equity, the free margin and the liquidation buffer are one number about
 * one pool, and on an isolated account each is a sum over Virtual Accounts that
 * liquidate independently. A group holds both, so a reader scanning the column
 * needs to know which arithmetic they are reading before they read it.
 *
 * The square corners keep it out of the pills' vocabulary — a solver, a chain
 * or a lifecycle chip is a rounded capsule, and this is a type tag, not a state.
 */
export function MarginModeTag({ crossMargin, variant = "short", className }: MarginModeTagProps) {
  const label = crossMargin
    ? variant === "short"
      ? "cross"
      : "Cross-margin"
    : variant === "short"
      ? "isolated"
      : "Isolated VAs";

  return (
    <span
      style={TONES[crossMargin ? "cross" : "isolated"]}
      title={
        crossMargin
          ? "Cross-margin — every position draws on one allocated pool, and the account liquidates as a whole."
          : "Isolated — every position opens its own Virtual Account and liquidates on its own."
      }
      className={cn(
        "inline-flex shrink-0 items-center rounded-[3px] border px-1.5 py-[2px]",
        "font-mono text-2xs leading-none font-semibold tracking-[0.1em] whitespace-nowrap uppercase",
        /* The ledger's tag is a fixed-width column, not a snug label: the two
           words differ by three characters, and a box that shrinks to fit left
           every address in the group starting at a different x. */
        variant === "short" ? "min-w-[68px] justify-center" : null,
        className,
      )}
    >
      <span className="-me-[0.1em]">{label}</span>
    </span>
  );
}
