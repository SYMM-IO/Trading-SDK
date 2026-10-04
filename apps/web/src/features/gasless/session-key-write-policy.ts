/** Shared by both deposit writes, which fail for the same reason. */
const DEPOSIT_REASON = "a deposit pulls USDC from your wallet itself, which a session key is never granted";

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
  ["grantDelegation", "only the account owner can grant, and the InstantLayer rejects a key-signed grant"],
]);

/**
 * Why a session key can never sign one write method, or `undefined` when it can
 * (given a delegation for it on the account the card picks).
 *
 * @param method - The contract method name, as shown on the card.
 */
export function getSessionKeyBlockedReason(method: string): string | undefined {
  return SESSION_KEY_BLOCKED_WRITES.get(method);
}
