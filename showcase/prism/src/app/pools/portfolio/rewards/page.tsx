import { PortfolioRewards } from "@/features/pools/portfolio-rewards";

/**
 * What being an LP has paid this wallet, and what has been taken out of it.
 *
 * Earned and claimed are two different ledgers on this backend and the page
 * keeps them apart: the chart and the total are accrual, the claim history is
 * settlement.
 */
export default function PoolsPortfolioRewardsPage() {
  return <PortfolioRewards />;
}
