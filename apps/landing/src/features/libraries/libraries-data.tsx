import { docsPaths, siteLinks } from "@/lib/site";
import type { ReactNode } from "react";

export interface LibraryEntry {
  /** Full published name, shown as the mono title. */
  pkg: string;
  /** Short role tag in the card corner. */
  role: string;
  description: string;
  /** A couple of concrete keywords for the footer. */
  tags: string[];
  href: string;
  icon: ReactNode;
  /**
   * Marks the foundational package. A featured card gets the animated
   * cobalt→violet border sweep so it reads as the place to start.
   */
  featured?: boolean;
}

export const libraries: LibraryEntry[] = [
  {
    pkg: "@symmio/trading-core",
    role: "Core",
    description:
      "The framework-agnostic base — contract reads and writes via viem, REST and GraphQL calls, and the calculations that turn raw protocol data into typed results.",
    tags: ["viem", "GraphQL", "calculations"],
    href: docsPaths.core,
    icon: <LayersIcon />,
    featured: true,
  },
  {
    pkg: "@symmio/trading-react",
    role: "React",
    description:
      "The React layer — hooks and a provider that bridge core to your wagmi and TanStack Query setup. Read positions, quotes, balances, and prices without wiring contract calls.",
    tags: ["hooks", "providers"],
    href: docsPaths.react,
    icon: <AtomIcon />,
  },
  {
    pkg: "@symmio/session-key",
    role: "Signing",
    description:
      "Local EVM session keys — generation, import, runtime manager state, and EIP-712 signing. Persistence and encryption stay in your app.",
    tags: ["EIP-712", "local"],
    href: docsPaths.sessionKey,
    icon: <KeyIcon />,
  },
  {
    pkg: "@symmio/utils",
    role: "Utils",
    description:
      "Framework-neutral primitives — token amount formatting, display formatters, address shorteners, and a Decimal.js bridge.",
    tags: ["format", "Decimal.js"],
    href: docsPaths.utils,
    icon: <SlidersIcon />,
  },
  {
    pkg: "@symmio/ui",
    role: "Design",
    description:
      "The design system behind our own apps — accessible, Radix-based primitives on Tailwind. Used by our surfaces; not required to consume the SDK.",
    tags: ["Radix", "Tailwind"],
    href: siteLinks.storybook,
    icon: <SwatchIcon />,
  },
];

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

function AtomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="currentColor" strokeWidth="1.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.5" stroke="currentColor" strokeWidth="1.6" transform="rotate(120 12 12)" />
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

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="8" cy="17" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function SwatchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" opacity="0.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" opacity="0.6" />
      <circle cx="17.5" cy="17.5" r="3.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
