import { LinkCard, type LinkCardProps } from "@/components/link-card";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@symm-frontier/ui/components/button";
import Link from "next/link";

const cards: Omit<LinkCardProps, "index">[] = [
  {
    href: "/contracts",
    eyebrow: "Contracts",
    title: "Contract methods",
    description:
      "Run live reads and writes against every method the SDK implements — browse by contract ABI or by flow.",
    icon: <LayersIcon />,
  },
  {
    href: "/solvers",
    eyebrow: "Solvers",
    title: "Solver markets",
    description: "Fetch tradable markets — symbols, leverage, fees, and state — straight from the chain's solver.",
    icon: <ChartIcon />,
  },
  {
    href: "/session-keys",
    eyebrow: "Local signing",
    title: "Session keys",
    description: "Create an encrypted browser-local signing key for delegated flows and later device transfer.",
    icon: <KeyIcon />,
  },
  {
    href: "/integration",
    eyebrow: "End to end",
    title: "Integration flow",
    description: "A production-grade deposit and withdraw console composed entirely from @symm-frontier/react hooks.",
    icon: <FlowIcon />,
  },
  {
    href: "/config",
    eyebrow: "Runtime",
    title: "Resolved config",
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
          SYMMIO SDK Console · HyperEVM
        </span>

        <h1 className="font-display text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.04]">
          Connect, inspect, and trade SYMMIO — <span className="text-primary">without the complexity</span>.
        </h1>

        <p className="text-muted-foreground max-w-2xl text-base leading-7 text-pretty">
          A reference console for the <span className="text-foreground font-medium">@symm-frontier</span> SDK. Run live
          contract reads and writes, move collateral end to end, and verify the resolved chain config — every call goes
          through the same surface third-party builders use.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/contracts">
              Browse contracts
              <ArrowIcon />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/integration">Integration demo</Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <LinkCard key={card.href} {...card} index={index} />
        ))}
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

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <circle cx="8" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M11.25 12H21m-4 0v3m-3-3v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 6H15a3 3 0 0 1 3 3v6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.7"
      />
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
