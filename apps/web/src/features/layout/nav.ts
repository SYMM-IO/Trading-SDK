export interface NavLink {
  href: string;
  label: string;
  /** Short supporting line shown in the "More" menu and the mobile drawer. Keep it under ~32 characters so it fits a menu column untruncated. */
  description?: string;
}

/** A titled cluster of secondary destinations, rendered as one section of the "More" menu and the mobile drawer. */
export interface NavGroup {
  label: string;
  links: readonly NavLink[];
}

/** Top-level destinations that always sit in the header bar. */
export const primaryNavLinks = [
  { href: "/", label: "Overview" },
  { href: "/integration", label: "Integration" },
] as const satisfies readonly NavLink[];

/** Secondary destinations, collapsed behind the header "More" menu and grouped by what they cover. */
export const secondaryNavGroups = [
  {
    label: "Market data",
    links: [
      { href: "/solvers", label: "Solvers", description: "Tradable markets per solver" },
      { href: "/pools", label: "Pools", description: "Permissionless market listings" },
      { href: "/price-service", label: "Price Service", description: "Enigma & Binance mark prices" },
      { href: "/candles", label: "Candles", description: "Historical & live OHLCV bars" },
      { href: "/orderbook", label: "Orderbook", description: "Synchronized live market depth" },
    ],
  },
  {
    label: "Protocol",
    links: [
      { href: "/contracts", label: "Contracts", description: "Live reads & writes per method" },
      { href: "/muon", label: "Muon API", description: "Oracle signatures for writes" },
      { href: "/config", label: "Config", description: "Resolved SYMMIO chain config" },
    ],
  },
  {
    label: "Execution",
    links: [
      { href: "/gasless", label: "Gasless", description: "Relay actions without native gas" },
      { href: "/session-keys", label: "Session Keys", description: "Browser-local delegated signer" },
    ],
  },
] as const satisfies readonly NavGroup[];

/** Every secondary destination, flattened in menu order. */
export const secondaryNavLinks: readonly NavLink[] = secondaryNavGroups.flatMap(
  (group): readonly NavLink[] => group.links,
);

/** Every destination in order — used by the footer sitemap and search. */
export const navLinks: readonly NavLink[] = [...primaryNavLinks, ...secondaryNavLinks];

/** The route of a "More" menu destination. Key a per-route map by this so a new page can't be left out of it. */
export type SecondaryNavHref = (typeof secondaryNavGroups)[number]["links"][number]["href"];

/** The route of any header destination. Key a per-route map by this so a new page can't be left out of it. */
export type NavHref = (typeof primaryNavLinks)[number]["href"] | SecondaryNavHref;

/** True when `pathname` should mark `href` as the active route. */
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** True when any of `links` is the active route — used to light up the "More" trigger. */
export function isAnyActive(pathname: string, links: readonly NavLink[]): boolean {
  return links.some((link) => isActivePath(pathname, link.href));
}
