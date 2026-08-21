import { MarketsScreen } from "@/features/markets/markets-screen";

/**
 * The discovery surface.
 *
 * The whole screen is one client component: it merges both deployments' market
 * lists, both solvers' 24h figures and both price sockets into a single table.
 */
export default function MarketsPage() {
  return <MarketsScreen />;
}
