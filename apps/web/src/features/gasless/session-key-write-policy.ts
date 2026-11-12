/** Shared by both deposit writes, which fail for the same reason. */
const DEPOSIT_REASON = "a deposit pulls USDC from your wallet itself, which a session key is never granted";

/** Shared by both delegation grants, which fail for the same reason. */
const GRANT_REASON = "only the account owner can grant, and the InstantLayer rejects a key-signed grant";
const TIMELOCK_GRANT_REASON = "the standard session-key grant does not include this timelock operation";
const PROTECTED_CORE_REASON = "the standard session-key grant does not include the protected Core wrapper";

/**
 * Relayable writes a session key can never sign here, each with the reason its
 * card shows on the disabled key control.
 *
 * The rule the table encodes: a card offers the session key for exactly the
 * writes the Session Keys page can grant — the SDK's `getSessionKeySelectors`
 * sets (`GASLESS_SESSION_KEY_SELECTORS` plus the opt-in
 * `GASLESS_SESSION_KEY_WITHDRAW_SELECTORS`). Every relayable write outside them
 * is listed here, so no card offers a signer whose call can only fail. It is a
 * per-method table rather than a derivation because those sets are `bytes4`
 * selectors, and the ABIs that would name them live in `@symmio/trading-core`.
 *
 * The deposits are the subtle entry. A key-signed operation makes the
 * InstantLayer install the account's **owner** as the AccountLayer signer, and
 * the core's `deposit` pulls collateral with `safeTransferFrom(signer, …)` — so
 * a key holding the selector could spend the owner's wallet USDC with no prompt.
 *
 * A write that is grantable but not yet granted on the card's account is a
 * different case — per account, not per method — and is left to the SDK's
 * pre-flight, which throws `GASLESS_SIGNER_NOT_DELEGATED` naming the missing
 * selectors.
 */
const SESSION_KEY_BLOCKED_WRITES: ReadonlyMap<string, string> = new Map([
  ["depositForAccount", DEPOSIT_REASON],
  ["depositAndAllocateForAccount", DEPOSIT_REASON],
  ["createSubAccounts", "account creation cannot be confined to one account, so it is never delegated"],
  ["deleteSubAccount", "deleting the account would destroy the delegation the key signs under"],
  ["earlyWithdraw", "early withdrawal must be submitted by the account owner"],
  ["setupTimelocks", TIMELOCK_GRANT_REASON],
  ["clearTimelocks", TIMELOCK_GRANT_REASON],
  ["timelockScheduleRecovery", TIMELOCK_GRANT_REASON],
  ["timelockProtectedCall", PROTECTED_CORE_REASON],
  ["timelockProtectedBatch", PROTECTED_CORE_REASON],
  ["grantDelegation", GRANT_REASON],
  ["grantDelegations", GRANT_REASON],
  [
    "approveOperationalFeeAllowance",
    "session keys are granted approveOperationalFeeWithMultiplier, not this two-argument approval",
  ],
]);

/**
 * Why a session key can never sign one write method, or `undefined` when it can
 * (given a delegation for it on the account the card picks).
 *
 * @param method - The contract method name, as shown on the card.
 */
export function getSessionKeyBlockedReason(method: string): string | undefined {
  if (method.startsWith("timelockAccount:")) {
    const name = method.slice("timelockAccount:".length);
    if (name === "allocate" || name === "deallocate") return PROTECTED_CORE_REASON;
    return SESSION_KEY_BLOCKED_WRITES.get(name);
  }
  if (method.startsWith("timelockNamed:")) {
    const name = method.slice("timelockNamed:".length);
    if (name === "addMargin" || name === "removeMargin") return undefined;
    return PROTECTED_CORE_REASON;
  }
  return SESSION_KEY_BLOCKED_WRITES.get(method);
}
