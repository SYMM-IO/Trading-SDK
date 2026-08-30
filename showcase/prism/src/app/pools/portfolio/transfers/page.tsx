import { UserTransfersPanel } from "@/features/pools/user-transfers-panel";

/**
 * Money in and out of every pool this wallet is an LP in.
 *
 * The one surface in Prism where a queued withdrawal can still be called back,
 * which is why it is a page of its own rather than a tab on the position table.
 */
export default function PoolsPortfolioTransfersPage() {
  return <UserTransfersPanel />;
}
