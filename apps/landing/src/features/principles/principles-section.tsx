import { Stagger, StaggerItem } from "@/components/reveal";
import type { ReactNode } from "react";

interface Principle {
  word: string;
  headline: string;
  body: string;
  icon: ReactNode;
}

const principles: Principle[] = [
  {
    word: "Simple",
    headline: "One surface, not many",
    body: "The same calls third-party builders use — no vendor-specific glue, no bespoke contract wiring to maintain.",
    icon: <BoltIcon />,
  },
  {
    word: "Correct",
    headline: "The compiler catches it",
    body: "Typed errors, input validation, and calculations verified against the perps-core contracts, cited in the docs.",
    icon: <ShieldIcon />,
  },
  {
    word: "Reliable",
    headline: "Consistency handled for you",
    body: "Realtime feeds, quote reconciliation, retries, and reconnection live inside the SDK — your UI just reads state.",
    icon: <PulseIcon />,
  },
];

/**
 * The SDK's three stated promises — simple, correct, reliable — made concrete.
 * A quiet band of three cards between the architecture and the package grid.
 */
export function PrinciplesSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {principles.map((principle) => (
          <StaggerItem key={principle.word} className="h-full">
            <article className="border-border/70 bg-card/50 flex h-full flex-col gap-4 rounded-2xl border p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="bg-primary/10 text-primary ring-primary/15 grid size-10 place-items-center rounded-xl ring-1">
                  {principle.icon}
                </span>
                <span className="text-foreground font-display text-sm font-semibold tracking-tight">
                  {principle.word}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-foreground text-base font-semibold tracking-tight">{principle.headline}</h3>
                <p className="text-muted-foreground text-sm leading-6">{principle.body}</p>
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path
        d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path
        d="M3 12h4l2-6 4 12 2-6h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
