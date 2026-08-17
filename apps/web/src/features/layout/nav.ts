export interface NavLink {
  href: string;
  label: string;
  /** Short supporting line shown in the "More" menu and the mobile drawer. */
  description?: string;
}

/** Top-level destinations that always sit in the header bar. */
export const primaryNavLinks: NavLink[] = [
  { href: "/", label: "Overview" },
  { href: "/integration", label: "Integration" },
];

/** Secondary destinations, collapsed behind the header "More" menu. */
export const secondaryNavLinks: NavLink[] = [
  { href: "/contracts", label: "Contracts", description: "Live reads & writes on every SDK method" },
  { href: "/solvers", label: "Solvers", description: "Tradable markets from the chain's solver" },
  { href: "/price-service", label: "Price Service", description: "Enigma & Binance mark prices" },
  { href: "/candles", label: "Candles", description: "Historical & live OHLCV chart data" },
  { href: "/orderbook", label: "Orderbook", description: "Synchronized live market depth" },
  { href: "/muon", label: "Muon API", description: "Oracle uPnL, price & settlement signatures" },
  { href: "/session-keys", label: "Session Keys", description: "Browser-local delegated signing key" },
  { href: "/config", label: "Config", description: "Resolved SYMMIO chain config" },
];

/** Every destination in order — used by the footer sitemap. */
export const navLinks: NavLink[] = [...primaryNavLinks, ...secondaryNavLinks];

/** True when `pathname` should mark `href` as the active route. */
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** True when any of `links` is the active route — used to light up the "More" trigger. */
export function isAnyActive(pathname: string, links: NavLink[]): boolean {
  return links.some((link) => isActivePath(pathname, link.href));
}
