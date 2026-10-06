import type { CSSProperties } from "react";

/** Token color roles, mapped onto the shared chart/semantic palette. */
const COLOR = {
  kw: "text-chart-5",
  fn: "text-primary",
  str: "text-positive",
  tag: "text-warning",
  prop: "text-foreground/90",
  punct: "text-muted-foreground",
  plain: "text-foreground/80",
  comment: "text-muted-foreground/60 italic",
} as const;

/** A single colored fragment of a code line: `[role, text]`. */
export type CodeToken = readonly [keyof typeof COLOR, string];

/** One line of source, as an ordered list of colored tokens. An empty array is a blank line. */
export type CodeLine = readonly CodeToken[];

/** Delay before the first line fades in — lands just after the reel's own entrance. */
const FIRST_LINE_DELAY_MS = 270;

/** Gap between consecutive lines, so the snippet reads as "typed". */
const LINE_STAGGER_MS = 60;

interface Props {
  /** Filename shown in the window chrome, e.g. `ticket.tsx`. */
  filename: string;
  /** Hand-tokenized source. Each line fades in on first paint to read as "typed". */
  lines: readonly CodeLine[];
  className?: string;
  /** When false, the lines appear settled with no stagger (for off-screen carousel slides). */
  animate?: boolean;
}

/**
 * A syntax-lit code card — the input half of the hero's "code → UI" pairing.
 * Hand-tokenized rather than run through a highlighter so it carries zero
 * dependencies and paints its own on-brand colors. The line stagger is the CSS
 * `animate-enter-fade` entrance, not a `motion` reveal, so the lines paint from
 * the server HTML instead of waiting for hydration.
 */
export function CodePane({ filename, lines, className, animate = true }: Props) {
  return (
    <div
      className={`border-border/70 bg-card/70 ring-border/40 overflow-hidden rounded-2xl border shadow-lg ring-1 backdrop-blur-md ${className ?? ""}`}
    >
      <div className="border-border/60 bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="bg-destructive/70 size-2.5 rounded-full" />
          <span className="bg-warning/70 size-2.5 rounded-full" />
          <span className="bg-positive/70 size-2.5 rounded-full" />
        </span>
        <span className="text-muted-foreground ml-1.5 font-mono text-xs">{filename}</span>
      </div>

      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 sm:text-[13px]">
        <code className="block">
          {lines.map((tokens, i) => (
            <span
              key={i}
              className={animate ? "animate-enter-fade flex min-h-6 whitespace-pre" : "flex min-h-6 whitespace-pre"}
              style={
                animate
                  ? ({ "--enter-delay": `${FIRST_LINE_DELAY_MS + i * LINE_STAGGER_MS}ms` } as CSSProperties)
                  : undefined
              }
            >
              <span className="text-muted-foreground/45 mr-4 inline-block w-4 shrink-0 text-right select-none">
                {i + 1}
              </span>
              <span>
                {tokens.map(([color, text], j) => (
                  <span key={j} className={COLOR[color]}>
                    {text}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
