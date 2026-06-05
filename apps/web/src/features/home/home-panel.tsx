import { StatusDot } from "@/components/status-dot";
import { Button } from "@symm-frontier/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@symm-frontier/ui/components/card";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

interface HomeCard {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const cards: HomeCard[] = [
  {
    href: "/inspector/account-layer",
    eyebrow: "Inspector",
    title: "AccountLayer",
    description: "Run live reads and writes against the AccountLayer slice — subaccounts, nonces, and creation flows.",
    icon: <LayersIcon />,
  },
  {
    href: "/inspector/markets",
    eyebrow: "Inspector",
    title: "Markets",
    description: "Fetch and filter tradable markets — symbols, leverage, fees, and state — straight from the solver.",
    icon: <ChartIcon />,
  },
  {
    href: "/config",
    eyebrow: "Runtime",
    title: "Resolved Config",
    description: "Inspect the chain config the app resolves from @symm-frontier/react — addresses, solver, subgraphs.",
    icon: <SlidersIcon />,
  },
];

export function HomePanel() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="animate-enter-up flex max-w-3xl flex-col gap-6">
        <span className="border-border/70 bg-muted/40 text-muted-foreground inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide">
          <StatusDot tone="positive" pulse />
          VibeCaps SDK Console · HyperEVM
        </span>

        <h1 className="font-display text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.04]">
          Connect, inspect, and trade SYMMIO — <span className="text-primary">without the complexity</span>.
        </h1>

        <p className="text-muted-foreground max-w-2xl text-base leading-7 text-pretty">
          A reference console for the <span className="text-foreground font-medium">@symm-frontier</span> SDK. Run live
          contract reads and writes, browse tradable markets, and verify the resolved chain config — every call goes
          through the same surface third-party builders use.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/inspector/account-layer">
              Open Inspector
              <ArrowIcon />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/inspector/markets">Browse markets</Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <HomeCardLink key={card.href} card={card} index={i} />
        ))}
      </div>
    </section>
  );
}

function HomeCardLink({ card, index }: { card: HomeCard; index: number }) {
  return (
    <Link
      href={card.href}
      className="group animate-enter-up block focus-visible:outline-none"
      style={{ "--enter-delay": `${120 + index * 90}ms` } as CSSProperties}
    >
      <Card className="group-focus-visible:ring-ring group-hover:ring-primary/40 relative h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-focus-visible:ring-2">
        <div
          className="bg-primary/15 pointer-events-none absolute -top-16 -right-12 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden
        />
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary ring-primary/15 flex size-11 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105">
              {card.icon}
            </span>
            <span className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
              {card.eyebrow}
            </span>
          </div>
          <CardTitle className="font-display mt-4 text-lg tracking-tight">{card.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-6">{card.description}</p>
          <span className="text-primary mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
            Open
            <ArrowIcon className="transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? "size-4"} aria-hidden>
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

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="m3 12 9 5 9-5M3 16l9 5 9-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path d="M4 20V4M4 20h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8 16v-3M12 16V9M16 16v-6M20 16V6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="8" cy="17" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
