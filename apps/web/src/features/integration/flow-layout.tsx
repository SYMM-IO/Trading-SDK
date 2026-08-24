"use client";

import type { ReactNode } from "react";
import { FlowGauge } from "./flow-gauge";
import { FlowRail, type FlowStep } from "./flow-rail";

interface Props {
  steps: readonly FlowStep[];
  /** Index of the step currently in focus. */
  current: number;
  /** Highest step index the user is allowed to navigate to. */
  maxReachable: number;
  /** Navigate to a step. */
  onStepClick: (index: number) => void;
  /** Panel for the focused step. */
  children: ReactNode;
}

/**
 * Shell shared by every wizard flow on the Integration console: the focused
 * step's panel plus a step navigator.
 *
 * The console is sized by its own container, never by the viewport — the magic
 * sidebar docks beside the page and can squeeze it to a narrow column while the
 * window stays wide. So the navigator switches on `@container/console` rather
 * than a media query: the full annotated {@link FlowRail} sits beside the panel
 * when there is room, and a compact {@link FlowGauge} sits above it when there
 * is not. Both drive the same `onStepClick`, so no step goes out of reach at any
 * width.
 */
export function FlowLayout({ steps, current, maxReachable, onStepClick, children }: Props) {
  return (
    <div className="flex flex-col gap-5 @3xl/console:grid @3xl/console:grid-cols-[minmax(0,1fr)_15rem] @3xl/console:gap-8">
      <FlowGauge
        steps={steps}
        current={current}
        maxReachable={maxReachable}
        onStepClick={onStepClick}
        className="@3xl/console:hidden"
      />

      <div className="flex min-h-60 min-w-0 flex-col gap-5">{children}</div>

      <div className="border-border/50 hidden border-l pl-8 @3xl/console:block">
        <FlowRail steps={steps} current={current} maxReachable={maxReachable} onStepClick={onStepClick} />
      </div>
    </div>
  );
}
