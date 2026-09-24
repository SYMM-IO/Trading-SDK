import type { ReactNode } from "react";

/**
 * A labelled group of rows inside an inspector result panel — the heading style
 * every card's sections share.
 */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground/80 border-border border-b pb-1 text-[0.65rem] font-medium tracking-wider uppercase">
        {title}
      </span>
      {children}
    </div>
  );
}

/**
 * Format an on-chain timestamp (seconds) for display. Returns `undefined` for
 * the `0n` sentinel, so a caller can render its own "never" placeholder.
 */
export function formatTimestampSeconds(seconds: bigint): string | undefined {
  if (seconds === 0n) return undefined;
  return new Date(Number(seconds) * 1000).toLocaleString();
}
