import { LiveDot } from "@/components/live-dot";
import { HeroShowcase } from "@/features/hero/hero-showcase";
import { sectionAnchors, siteLinks } from "@/lib/site";
import { Button } from "@symmio/ui/components/button";
import type { CSSProperties } from "react";

const trustPoints = ["TypeScript-native", "Framework-agnostic core", "MIT licensed"];

/**
 * The hero: a thesis on the left, the SDK's output rendering on the right.
 *
 * A server component on purpose. The copy staggers in with the CSS
 * `animate-enter-up` entrance rather than a `motion` reveal, so the server HTML
 * carries the headline fully visible — crawlers read it as-is and the LCP paint
 * never waits for hydration.
 */
export function Hero() {
  return (
    <section id="top" className="relative">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-4 pt-28 pb-20 sm:px-6 lg:grid-cols-[1.05fr_minmax(0,1fr)] lg:items-center lg:gap-10 lg:pt-36 lg:pb-28 xl:gap-16">
        <div className="flex flex-col items-start">
          <span
            className="animate-enter-up border-border/70 bg-muted/40 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide"
            style={{ "--enter-delay": "0ms" } as CSSProperties}
          >
            <LiveDot tone="positive" />
            The SYMMIO SDK · Arbitrum · Base
          </span>

          <h1
            className="animate-enter-up font-display text-foreground mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl lg:leading-[1.03]"
            style={{ "--enter-delay": "80ms" } as CSSProperties}
          >
            Build on SYMMIO — <span className="text-sheen bg-clip-text">without the complexity</span>.
          </h1>

          <p
            className="animate-enter-up text-muted-foreground mt-6 max-w-xl text-base leading-7 text-pretty"
            style={{ "--enter-delay": "160ms" } as CSSProperties}
          >
            One SDK for the entire protocol surface.{" "}
            <span className="text-foreground font-medium">@symmio/trading-core</span> and{" "}
            <span className="text-foreground font-medium">trading-react</span> wrap contracts, solvers, prices, and Muon
            behind a simple, correct, reliable API — so you build the interface, not the plumbing.
          </p>

          <div
            className="animate-enter-up mt-8 flex flex-wrap items-center gap-3"
            style={{ "--enter-delay": "240ms" } as CSSProperties}
          >
            <Button asChild size="lg">
              <a href={sectionAnchors.start}>
                Get started
                <ArrowIcon />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={siteLinks.docs} target="_blank" rel="noreferrer">
                Read the docs
              </a>
            </Button>
          </div>

          <ul
            className="animate-enter-up mt-10 flex flex-wrap gap-x-6 gap-y-2"
            style={{ "--enter-delay": "320ms" } as CSSProperties}
          >
            {trustPoints.map((point) => (
              <li key={point} className="text-muted-foreground flex items-center gap-2 text-sm">
                <CheckIcon />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <HeroShowcase />
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="text-primary size-4 shrink-0" aria-hidden>
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
