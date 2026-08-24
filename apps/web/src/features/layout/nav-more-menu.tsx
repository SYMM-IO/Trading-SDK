"use client";

import { isActivePath, isAnyActive, secondaryNavLinks } from "@/features/layout/nav";
import { Popover, PopoverContent, PopoverTrigger } from "@symmio/ui/components/popover";
import { cn } from "@symmio/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactElement, type SVGProps } from "react";

/** Per-route glyphs for the secondary destinations, keyed by href. */
const ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  "/contracts": LayersIcon,
  "/solvers": SolverIcon,
  "/price-service": PriceIcon,
  "/candles": CandlesIcon,
  "/orderbook": OrderbookIcon,
  "/muon": MuonIcon,
  "/session-keys": KeyIcon,
  "/config": GearIcon,
};

/**
 * The desktop header "More" control: a nav-styled trigger that opens an anchored
 * popover listing the {@link secondaryNavLinks}. Each row pairs an icon tile with
 * a label and a one-line description, mirroring a modern site's overflow menu. The
 * trigger keeps the active underline when one of its routes is current.
 */
export function NavMoreMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const anyActive = isAnyActive(pathname, secondaryNavLinks);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More pages"
          className={cn(
            "relative inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors outline-none",
            anyActive || open ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          More
          <ChevronIcon className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
          {anyActive ? (
            <span className="bg-primary absolute inset-x-3 -bottom-px h-0.5 rounded-full" aria-hidden />
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={14} className="w-72 p-1.5">
        <ul className="flex flex-col gap-0.5">
          {secondaryNavLinks.map((link) => {
            const active = isActivePath(pathname, link.href);
            const Icon = ICONS[link.href];
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors",
                    active ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/70 bg-muted/40 text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {Icon ? <Icon className="size-[18px]" /> : null}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-foreground text-sm font-medium">{link.label}</span>
                    {link.description ? (
                      <span className="text-muted-foreground truncate text-xs">{link.description}</span>
                    ) : null}
                  </span>
                  <ArrowIcon className="text-muted-foreground/0 group-hover:text-muted-foreground ml-auto size-4 shrink-0 -translate-x-1 transition-all group-hover:translate-x-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M5 12h13M12 6l6 6-6 6" />
    </svg>
  );
}

function LayersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </svg>
  );
}

function SolverIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-3M12 16V9M16 16v-6M20 16V6" />
    </svg>
  );
}

function PriceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M3 12h4l3 7 4-14 3 7h4" />
    </svg>
  );
}

function CandlesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M8 3v4M8 16v5" />
      <rect x="5.5" y="7" width="5" height="9" rx="1" />
      <path d="M16 5v4M16 15v4" />
      <rect x="13.5" y="9" width="5" height="6" rx="1" />
    </svg>
  );
}

function OrderbookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {/* A ladder thinning away from the spread, with the seam drawn across the middle. */}
      <path d="M18 4H9M18 7.5h-5M18 11H14" />
      <path d="M3.5 14.5H21" />
      <path d="M18 18h-4M18 21.5H9" />
    </svg>
  );
}

function KeyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.8 12.2 9-9M16 6.5 19 9.5M18.5 4 21 6.5" />
    </svg>
  );
}

function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3 16.9 7.1M7.1 16.9l-1.8 1.8M18.7 18.7 16.9 16.9M7.1 7.1 5.3 5.3" />
    </svg>
  );
}

function MuonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(120 12 12)" />
    </svg>
  );
}
