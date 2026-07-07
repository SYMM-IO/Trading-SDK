import { Reveal } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { siteLinks } from "@/lib/site";
import { Button } from "@symmio/ui/components/button";
import { CopyButton } from "@symmio/ui/components/copy-button";
import type { ReactNode } from "react";

const INSTALL_COMMAND = "pnpm add @symmio/trading-core @symmio/trading-react";

interface Step {
  label: string;
  code: ReactNode;
}

const steps: Step[] = [
  {
    label: "Install the packages",
    code: (
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate">
          <span className="text-muted-foreground">$ </span>
          <span className="text-foreground">pnpm add </span>
          <span className="text-primary">@symmio/trading-core @symmio/trading-react</span>
        </span>
        <CopyButton value={INSTALL_COMMAND} hideTooltip label="Copy install command" className="shrink-0" />
      </div>
    ),
  },
  {
    label: "Wrap your app once",
    code: (
      <span>
        <span className="text-muted-foreground">{"<"}</span>
        <span className="text-warning">SymmioProvider</span>
        <span className="text-muted-foreground">{"> … </"}</span>
        <span className="text-warning">SymmioProvider</span>
        <span className="text-muted-foreground">{">"}</span>
      </span>
    ),
  },
  {
    label: "Read protocol state with hooks",
    code: (
      <span>
        <span className="text-chart-5">const</span>
        <span className="text-foreground"> {"{ positions } "}</span>
        <span className="text-chart-5">=</span>
        <span className="text-primary"> usePositions</span>
        <span className="text-muted-foreground">();</span>
      </span>
    ),
  },
];

/** Install-and-go section — three real steps and the paths onward. */
export function GetStarted() {
  return (
    <section id="start" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="border-border/70 from-primary/[0.06] relative overflow-hidden rounded-3xl border bg-gradient-to-br to-transparent p-8 sm:p-12 lg:p-14">
        <div
          className="bg-primary/15 pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl"
          aria-hidden
        />
        <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1fr_minmax(0,1.1fr)] lg:items-center">
          <Reveal>
            <SectionHeading
              eyebrow="Get started"
              title="Three steps to your first read."
              description="Install the packages, wrap your app in the provider once, then read positions, quotes, balances, and prices with hooks. Bring your own wagmi and TanStack Query setup — the SDK bridges to it."
            />
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href={siteLinks.docs} target="_blank" rel="noreferrer">
                  Read the docs
                  <ArrowIcon />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href={siteLinks.console} target="_blank" rel="noreferrer">
                  Open the console
                </a>
              </Button>
            </div>
            <p className="text-muted-foreground mt-6 text-xs">
              MIT licensed · works with wagmi + TanStack Query · TypeScript-native
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="border-border/70 bg-card/80 overflow-hidden rounded-2xl border shadow-xl backdrop-blur-md">
              <div className="border-border/60 bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="bg-destructive/70 size-2.5 rounded-full" />
                  <span className="bg-warning/70 size-2.5 rounded-full" />
                  <span className="bg-positive/70 size-2.5 rounded-full" />
                </span>
                <span className="text-muted-foreground ml-1.5 font-mono text-xs">quickstart</span>
              </div>
              <ol className="flex flex-col">
                {steps.map((step, index) => (
                  <li key={step.label} className="border-border/50 flex gap-4 border-b px-5 py-4 last:border-b-0">
                    <span className="text-primary bg-primary/10 ring-primary/15 mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-semibold ring-1">
                      {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-foreground text-sm font-medium">{step.label}</span>
                      <div className="border-border/60 bg-background/60 rounded-lg border px-3 py-2 font-mono text-xs leading-5">
                        {step.code}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
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
