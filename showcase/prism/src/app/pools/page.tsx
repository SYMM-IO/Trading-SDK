import { PoolsScreen } from "@/features/pools/pools-screen";

/**
 * Discover — the pools index.
 *
 * The public half of the surface: system-wide aggregates and the listing
 * catalog, with no wallet required. Everything this wallet owns lives one route
 * over, at `/pools/portfolio`.
 *
 * Unlike every other screen, this one does not fan out over deployments: the
 * listing backend is chain-level and only the lowcaps chain has one. The
 * heading, the scope notice, the section tabs, the page container and the
 * listing session all come from `src/app/pools/layout.tsx`.
 */
export default function PoolsPage() {
  return <PoolsScreen />;
}
