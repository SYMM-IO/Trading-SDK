import { PortfolioPools } from "@/features/pools/portfolio-pools";

/**
 * The LP's own ledger: every pool this wallet has a door into.
 *
 * Authed end to end — the listing backend knows an LP by signature, so this
 * page is a sign-in prompt until one is held.
 */
export default function PoolsPortfolioPage() {
  return <PortfolioPools />;
}
