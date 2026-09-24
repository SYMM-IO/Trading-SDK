"use client";
import { cn } from "@symmio/ui/lib/utils";
import type { JourneyStage } from "./quote-journey";

/**
 * Dot styling per stage tone.
 *
 * `current` is the only tone that changes with the quote: a stage the chain has
 * confirmed reads mint, one still in flight reads coral. Coral is reserved
 * across the whole surface for "not settled yet", so a board of confirmed rows
 * stays grey and the eye lands on the one that is still moving.
 */
function dotClassName(tone: JourneyStage["tone"], settled: boolean): string {
  switch (tone) {
    case "current":
      return settled ? "bg-positive ring-positive/25 ring-4" : "bg-primary ring-primary/25 ring-4";
    case "failed":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/70";
  }
}

interface Props {
  /** Stages the quote has reached, current last. */
  stages: JourneyStage[];
  /** Stage names still ahead, collapsed into one dim line. */
  remaining: string[];
  /** Whether the chain has confirmed the quote — tones the current stage. */
  settled: boolean;
}

/**
 * A quote's provenance rail, in whichever direction the container can afford.
 *
 * Below `@2xl` the rail runs **down**: nine possible stages across a 464px
 * sidebar leaves about 50px each, enough for a dot and nothing else, while a
 * vertical line gives every stage room for the evidence that proves it — the
 * temp id, the fill price, the anchored id. Above it the rail runs across, which
 * reads faster when there is width to spare.
 *
 * Both directions render and one is hidden, the same way {@link FlowLayout}
 * pairs its rail and gauge, so no stage is ever unreachable at any width.
 */
export function QuoteJourneyRail({ stages, remaining, settled }: Props) {
  return (
    <>
      <JourneyRailVertical stages={stages} remaining={remaining} settled={settled} className="@2xl/quotes:hidden" />
      <JourneyRailHorizontal
        stages={stages}
        remaining={remaining}
        settled={settled}
        className="hidden @2xl/quotes:block"
      />
    </>
  );
}

function JourneyRailVertical({ stages, remaining, settled, className }: Props & { className?: string }) {
  const hasRemaining = remaining.length > 0;
  return (
    <ol className={cn("flex flex-col", className)}>
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1 && !hasRemaining;
        return (
          <li key={stage.key} className="flex gap-3">
            <div className="flex w-2 shrink-0 flex-col items-center">
              <span
                className={cn("mt-1 size-2 shrink-0 rounded-full", dotClassName(stage.tone, settled))}
                aria-hidden
              />
              {isLast ? null : <span className="bg-border w-px flex-1" aria-hidden />}
            </div>
            <div className={cn("flex min-w-0 flex-1 items-baseline justify-between gap-3", isLast ? "pb-0" : "pb-2.5")}>
              <span
                className={cn(
                  "truncate text-xs",
                  stage.tone === "current" ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {stage.label}
              </span>
              {stage.detail ? (
                <span className="text-muted-foreground/80 shrink-0 font-mono text-[0.7rem]">{stage.detail}</span>
              ) : null}
            </div>
          </li>
        );
      })}
      {hasRemaining ? (
        <li className="flex gap-3">
          <div className="flex w-2 shrink-0 flex-col items-center">
            <span className="border-border mt-1 size-2 shrink-0 rounded-full border" aria-hidden />
          </div>
          <span className="text-muted-foreground/70 truncate text-[0.7rem]">then {remaining.join(" → ")}</span>
        </li>
      ) : null}
    </ol>
  );
}

function JourneyRailHorizontal({ stages, remaining, settled, className }: Props & { className?: string }) {
  const total = stages.length + remaining.length;
  return (
    <div className={className}>
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {stages.map((stage, index) => (
          <li key={stage.key} className="flex flex-col gap-1.5">
            <div className="flex items-center" aria-hidden>
              <span className={cn("h-px flex-1", index === 0 ? "bg-transparent" : "bg-border")} />
              <span className={cn("size-2 shrink-0 rounded-full", dotClassName(stage.tone, settled))} />
              <span className={cn("h-px flex-1", index === total - 1 ? "bg-transparent" : "bg-border")} />
            </div>
            <div className="flex min-w-0 flex-col pr-3 leading-tight">
              <span
                className={cn(
                  "truncate text-xs",
                  stage.tone === "current" ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {stage.label}
              </span>
              {stage.detail ? (
                <span className="text-muted-foreground/80 truncate font-mono text-[0.7rem]">{stage.detail}</span>
              ) : null}
            </div>
          </li>
        ))}
        {remaining.map((label, index) => {
          const position = stages.length + index;
          return (
            <li key={label} className="flex flex-col gap-1.5">
              <div className="flex items-center" aria-hidden>
                <span className="bg-border/60 h-px flex-1" />
                <span className="border-border size-2 shrink-0 rounded-full border" />
                <span className={cn("h-px flex-1", position === total - 1 ? "bg-transparent" : "bg-border/60")} />
              </div>
              <span className="text-muted-foreground/70 truncate pr-3 text-xs first-letter:uppercase">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
