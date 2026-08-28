import { PoolsScreen } from "@/features/pools/pools-screen";

/**
 * The pools catalog.
 *
 * Unlike every other screen, this one does not fan out over deployments: the
 * listing backend is chain-level and only the lowcaps chain has one.
 */
export default function PoolsPage() {
  return <PoolsScreen />;
}
