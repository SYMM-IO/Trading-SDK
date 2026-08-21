import type { FundingAccount } from "@/features/accounts/account-provider";
import type { AccountBalanceInfo } from "@symmio/trading-core";
import { SubAccountIsolationType, calculateAvailableForOrder, calculateMarginRisk } from "@symmio/trading-core";

/** SYMMIO reports account balances in 18-decimal fixed point whatever the collateral. */
export const BALANCE_DECIMALS = 18;

/** True when this account trades cross-margin rather than through Virtual Accounts. */
export function isCrossMargin(account: FundingAccount): boolean {
  return account.detail.isolationType === SubAccountIsolationType.CUSTOM;
}

/**
 * Margin locked against this account's open and pending positions.
 *
 * The naive sum of every `locked*` field is wrong: `lockedPartyBMM` and its
 * pending twin are **partyB's** maintenance margin, not partyA's. The contract's
 * own `totalForPartyA()` is `cva + partyAmm + lf`, which is exactly what
 * `calculateMarginRisk` reports as `initialMargin` — so the figure comes from
 * the SDK rather than a re-derivation that overstates it.
 */
export function lockedMargin(balance: AccountBalanceInfo | undefined): bigint {
  if (!balance) return 0n;
  return calculateMarginRisk({
    allocatedBalance: balance.allocatedBalance,
    lockedCVA: balance.lockedCVA,
    lockedLF: balance.lockedLF,
    lockedPartyAMM: balance.lockedPartyAMM,
    upnl: 0n,
  }).initialMargin;
}

/**
 * Collateral this account can still commit to a new order.
 *
 * The margin model follows the sub-account's **isolation type**, not its solver:
 *
 * - A cross-margin (`CUSTOM`) account trades out of its allocated pool, so the
 *   spendable figure is the contract's own formula over that snapshot — which
 *   nets unrealized PnL and charges the larger of a loss and the maintenance
 *   margin rather than both.
 * - A VA-isolated account trades out of its **available** balance instead; the
 *   allocated pool is not reachable by an instant open at all.
 *
 * This is a display figure. The ticket's real ceiling is
 * `useAvailableInstantOpenMargin`, which additionally shaves fees, worst-case
 * slippage, and the Rasa solver's 10% reserve — none of which belong in a
 * portfolio row.
 *
 * @param account The funding account.
 * @param upnl Signed, whole-account unrealized PnL in wei. Only used cross-margin.
 */
export function spendableMargin(account: FundingAccount, upnl: bigint = 0n): bigint {
  if (!isCrossMargin(account)) return account.available ?? 0n;
  if (!account.balance) return 0n;
  const free = calculateAvailableForOrder({ balanceInfo: account.balance, upnl });
  return free > 0n ? free : 0n;
}

/**
 * What this account is worth, in the pot its own margin model spends from.
 *
 * A cross-margin account holds its collateral in the allocated pool; a
 * VA-isolated account holds spendable collateral in the available balance and
 * the rest inside its Virtual Accounts. Reading `allocatedBalance` for both — as
 * this app did — reports `$0.00` for a correctly funded lowcap account and full
 * equity for one whose money is stranded in the pool an instant open cannot
 * reach.
 *
 * @param account The funding account.
 * @param virtualAccountMargin Margin held inside this account's VAs, when resolved.
 */
export function accountEquity(account: FundingAccount, virtualAccountMargin: bigint = 0n): bigint {
  if (isCrossMargin(account)) return account.balance?.allocatedBalance ?? 0n;
  return (account.available ?? 0n) + virtualAccountMargin;
}
