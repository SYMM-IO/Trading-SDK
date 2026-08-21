"use client";

import { cn } from "@/lib/cn";

export type FlowStepState = "done" | "active" | "idle";

export interface FlowStepProps {
  index: number;
  label: string;
  detail?: string;
  state: FlowStepState;
}

/**
 * One numbered step in a multi-transaction flow.
 *
 * Approve-then-deposit is genuinely two wallet signatures, and pretending it is
 * one button is how funding UIs lose people halfway through. The steps stay
 * visible for the whole flow so the second prompt is never a surprise.
 */
export function FlowStep({ index, label, detail, state }: FlowStepProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn(
          "tnum flex size-[18px] shrink-0 items-center justify-center rounded-full border text-2xs font-semibold",
          state === "done"
            ? "border-transparent bg-long-bg text-long"
            : state === "active"
              ? "border-accent-bd bg-accent-bg text-accent"
              : "border-line bg-bg-2 text-fg-3",
        )}
      >
        {state === "done" ? <CheckIcon /> : index}
      </span>
      <span className={cn("text-base whitespace-nowrap", state === "idle" ? "text-fg-3" : "font-semibold text-fg-1")}>
        {label}
      </span>
      {detail ? <span className="ml-auto truncate text-2xs text-fg-3">{detail}</span> : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" width="9" height="9" fill="none" aria-hidden>
      <path
        d="M2 6.2l2.6 2.6L10 3.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
