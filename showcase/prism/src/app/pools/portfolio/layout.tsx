import { PortfolioNav } from "@/features/pools/portfolio-nav";
import type { ReactNode } from "react";

/**
 * The signed-in half of the Pools surface.
 *
 * Everything under `/pools/portfolio` answers only for the wallet that signed
 * the listing session, and the three pages differ in what they ask that session
 * for — positions, rewards, transfers. The tab strip is the only chrome they
 * share, so it is the only thing this layout adds; the session provider and the
 * page column both already come from `src/app/pools/layout.tsx`.
 *
 * The fragment is deliberate: the strip and the page below it become siblings
 * in the parent's flex column and inherit its `gap-4`, so no page under here
 * declares spacing or width of its own.
 */
export default function PoolsPortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PortfolioNav />
      {children}
    </>
  );
}
