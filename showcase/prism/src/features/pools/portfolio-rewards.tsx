import { ClaimHistoryPanel } from "./claim-history-panel";
import { YourRewardsPanel } from "./your-rewards-panel";

/**
 * "Your liquidity → Rewards": what the position earned, then what was taken out.
 *
 * The two panels are two ledgers and the order is the argument. Above, accrual:
 * a windowed total and a daily series the service builds from its own snapshots,
 * which claiming never reduces. Below, settlement: every claim this wallet has
 * actually made, with no pool filter, so the page reads as one story — earned
 * here, moved there.
 *
 * Blending them into a single "rewards" figure is the thing this layout refuses
 * to do. A reader who saw one number could not tell an unclaimed balance from a
 * claimed one, and the Claim buttons on the positions page act on the first.
 */
export function PortfolioRewards() {
  return (
    <>
      <YourRewardsPanel />

      <ClaimHistoryPanel />

      <p className="max-w-[104ch] px-1 text-2xs text-fg-3">
        Earned and claimed come from different endpoints and do not have to reconcile on any given day: the series is
        snapshotted daily, a claim settles when the service processes it, and a claim carries a transaction hash only
        once it has one. The claimable balance itself is neither of these — it is a per-pool read, and it sits on the
        positions page beside the button that spends it.
      </p>
    </>
  );
}
