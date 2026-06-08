export interface NavLink {
  href: string;
  label: string;
}

/** Primary navigation, shared by the header and footer. */
export const navLinks: NavLink[] = [
  { href: "/", label: "Overview" },
  { href: "/contracts", label: "Contracts" },
  { href: "/solvers", label: "Solvers" },
  { href: "/price-service", label: "Price Service" },
  { href: "/session-keys", label: "Session Keys" },
  { href: "/integration", label: "Integration" },
  { href: "/config", label: "Config" },
];

/** True when `pathname` should mark `href` as the active route. */
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
