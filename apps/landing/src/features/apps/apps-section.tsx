import { Reveal, Stagger, StaggerItem } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { siteLinks } from "@/lib/site";
import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";

interface AppEntry {
  name: string;
  kind: string;
  description: string;
  href: string;
  /** Accent token used for the preview wash — keeps the trio visually distinct. */
  accent: "primary" | "chart-5" | "chart-2";
  /**
   * The card's identity glyph. Rendered twice: small in the badge, and blown up
   * as a faint watermark that fills the preview panel. Takes `className` so the
   * same drawing serves both sizes.
   */
  Glyph: (props: { className?: string }) => ReactNode;
}

const apps: AppEntry[] = [
  {
    name: "Web console",
    kind: "apps/web",
    description:
      "Connect a wallet and drive every SDK call live — contract reads and writes, deposits and withdrawals, quotes and positions.",
    href: siteLinks.console,
    accent: "primary",
    Glyph: TerminalGlyph,
  },
  {
    name: "Documentation",
    kind: "apps/docs",
    description:
      "The full API reference — every hook, type, and function, with runnable examples and the concepts behind them.",
    href: siteLinks.docs,
    accent: "chart-5",
    Glyph: BookGlyph,
  },
  {
    name: "Storybook",
    kind: "apps/storybook",
    description: "Browse @symmio/ui in isolation — every primitive, every state, fully interactive.",
    href: siteLinks.storybook,
    accent: "chart-2",
    Glyph: BlocksGlyph,
  },
];

const accentClasses: Record<AppEntry["accent"], { wash: string; text: string; ring: string }> = {
  primary: { wash: "from-primary/20", text: "text-primary", ring: "ring-primary/20" },
  "chart-5": { wash: "from-chart-5/20", text: "text-chart-5", ring: "ring-chart-5/20" },
  "chart-2": { wash: "from-chart-2/20", text: "text-chart-2", ring: "ring-chart-2/20" },
};

/** The apps built on the SDK — the console, the docs, and the component explorer. */
export function AppsSection() {
  return (
    <section id="apps" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="Apps"
          title="Built on the same SDK you'd use."
          description="Our own surfaces consume trading-core and trading-react exactly the way a third-party integrator would — the console is the reference implementation."
        />
      </Reveal>

      <Stagger className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {apps.map((app) => {
          const accent = accentClasses[app.accent];
          return (
            <StaggerItem key={app.name} className="h-full">
              <a
                href={app.href}
                target="_blank"
                rel="noreferrer"
                className="group border-border/70 bg-card/60 hover:border-border focus-visible:ring-ring flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm backdrop-blur-sm transition-all duration-300 outline-none hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2"
              >
                <div className={cn("relative h-32 overflow-hidden border-b", "border-border/60")}>
                  <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent", accent.wash)} aria-hidden />
                  <div
                    className="absolute inset-0 opacity-[0.35]"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, color-mix(in oklab, var(--border) 80%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 80%, transparent) 1px, transparent 1px)",
                      backgroundSize: "22px 22px",
                    }}
                    aria-hidden
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute -top-7 -right-7 opacity-[0.13] transition-all duration-500 group-hover:scale-105 group-hover:opacity-20",
                      accent.text,
                    )}
                    aria-hidden
                  >
                    <app.Glyph className="size-40" />
                  </div>
                  <div className="absolute top-4 left-4 flex gap-1.5" aria-hidden>
                    <span className="bg-muted-foreground/30 size-2 rounded-full" />
                    <span className="bg-muted-foreground/30 size-2 rounded-full" />
                    <span className="bg-muted-foreground/30 size-2 rounded-full" />
                  </div>
                  <div
                    className={cn(
                      "bg-background/70 absolute bottom-4 left-4 grid size-12 place-items-center rounded-xl ring-1 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105",
                      accent.text,
                      accent.ring,
                    )}
                  >
                    <app.Glyph />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-foreground font-display text-base font-semibold tracking-tight">{app.name}</h3>
                    <span className="text-muted-foreground font-mono text-[11px]">{app.kind}</span>
                  </div>
                  <p className="text-muted-foreground mt-2 flex-1 text-sm leading-6">{app.description}</p>
                  <span className={cn("mt-4 inline-flex items-center gap-1 text-sm font-medium", accent.text)}>
                    Open
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                      aria-hidden
                    >
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </a>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}

function TerminalGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 8l3 3-3 3M11 14h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
    </svg>
  );
}

function BookGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5v-12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 0 1.5-1.5v-12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

function BlocksGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
