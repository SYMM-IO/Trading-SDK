import type { ReactNode } from "react";
import { METHOD_REGISTRY, type AbiKey, type GroupKey, type MethodEntry } from "./registry";

/** A Contracts sub-page: either an ABI (all methods of one contract) or a usage flow. */
export interface ContractPage {
  slug: string;
  kind: "abi" | "flow";
  abi?: AbiKey;
  group?: GroupKey;
  /** Card eyebrow / page kicker. */
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  /** Lay method cards out in one full-width column instead of the two-column grid. */
  fullWidth?: boolean;
}

/** ABI section — one page per on-chain contract, listing every implemented method. */
export const ABI_PAGES: readonly ContractPage[] = [
  {
    slug: "account-layer",
    kind: "abi",
    abi: "account-layer",
    eyebrow: "ABI",
    title: "AccountLayer",
    description: "Subaccount lifecycle and deposits — every method called directly against the AccountLayer diamond.",
    icon: <LayersIcon />,
  },
  {
    slug: "symmio-core",
    kind: "abi",
    abi: "symmio-core",
    eyebrow: "ABI",
    title: "SYMMIO Core",
    description:
      "The request-based withdraw system on the core diamond — initiate, finalize, cancel, and the read views.",
    icon: <CoreIcon />,
  },
  {
    slug: "collateral",
    kind: "abi",
    abi: "collateral",
    eyebrow: "ABI",
    title: "Collateral (ERC20)",
    description: "The collateral token surface the SDK touches — approve the core, and read allowance and balance.",
    icon: <CoinIcon />,
  },
  {
    slug: "instant-layer",
    kind: "abi",
    abi: "instant-layer",
    eyebrow: "ABI",
    title: "InstantLayer",
    description: "Delegated signer access for Instant Layer reads and writes.",
    icon: <BoltIcon />,
    fullWidth: true,
  },
];

/** Usage section — one page per flow, gathering its methods across contracts. */
export const FLOW_PAGES: readonly ContractPage[] = [
  {
    slug: "subaccounts",
    kind: "flow",
    group: "subaccounts",
    eyebrow: "Flow",
    title: "Subaccounts",
    description: "Create and rename subaccounts, and read their state, nonces, and counts.",
    icon: <UsersIcon />,
  },
  {
    slug: "deposit",
    kind: "flow",
    group: "deposit",
    eyebrow: "Flow",
    title: "Deposit",
    description: "Approve collateral, then deposit — with or without allocating to margin — plus the balance reads.",
    icon: <DepositIcon />,
  },
  {
    slug: "withdraw",
    kind: "flow",
    group: "withdraw",
    eyebrow: "Flow",
    title: "Withdraw",
    description: "Open, finalize, and cancel withdraw requests, and read pending requests and cooldown timing.",
    icon: <WithdrawIcon />,
  },
  {
    slug: "delegation",
    kind: "flow",
    group: "delegation",
    eyebrow: "Flow",
    title: "Delegation",
    description: "Read and grant Instant Layer delegated signer access by selector.",
    icon: <BoltIcon />,
    fullWidth: true,
  },
];

/** Every Contracts sub-page, for routing and static generation. */
export const ALL_PAGES: readonly ContractPage[] = [...ABI_PAGES, ...FLOW_PAGES];

/** Resolve a sub-page by its slug. */
export function getContractPage(slug: string): ContractPage | undefined {
  return ALL_PAGES.find((page) => page.slug === slug);
}

/** The method-card entries that belong to a sub-page. */
export function entriesForPage(page: ContractPage): MethodEntry[] {
  return METHOD_REGISTRY.filter((entry) =>
    page.kind === "abi" ? entry.abi === page.abi : Boolean(page.group && entry.groups.includes(page.group)),
  );
}

/** How many methods a sub-page lists — used for the hub card meta. */
export function methodCount(page: ContractPage): number {
  return entriesForPage(page).length;
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

function CoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path d="M12 2.5 21 7v10l-9 4.5L3 17V7l9-4.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="M12 7.5 16.5 10v4L12 16.5 7.5 14v-4L12 7.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M14.5 9.5C14 8.5 13 8 12 8c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path
        d="M13 2.75 5.5 13h5.75L11 21.25 18.5 11h-5.75L13 2.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M16 5.5a3 3 0 0 1 0 5.8M17.5 19a5.5 5.5 0 0 0-3-4.9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

function DepositIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path
        d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WithdrawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path
        d="M12 13V3m0 0 3.5 3.5M12 3 8.5 6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
