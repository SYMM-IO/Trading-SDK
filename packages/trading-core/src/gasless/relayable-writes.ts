import { toFunctionSelector, type Abi, type AbiFunction, type Hex } from "viem";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { instantLayerAbi } from "../symmio-contracts/abi/v0.8.6/instant-layer";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";

function selectorFromAbi(abi: Abi, name: string): Hex {
  const fragment = abi.find((item) => item.type === "function" && item.name === name) as AbiFunction | undefined;
  if (!fragment) {
    throw new Error(`relayable-writes: ABI is missing function "${name}" — the shipped ABI changed shape.`);
  }
  return toFunctionSelector(fragment);
}

/**
 * Which contract a relayable write targets.
 *
 * Documentation only — the seam that builds the call supplies the concrete
 * address, and the dispatcher passes it through untouched.
 */
export type GaslessRelayableTarget = "symmio" | "accountLayer" | "instantLayer";

/** One relayable write: its target contract and the workflow label to relay under. */
export interface GaslessRelayableWrite {
  /** Contract the InstantLayer calls with this calldata. */
  target: GaslessRelayableTarget;
  /** Stable `operationType` label stored with relayed requests of this kind. */
  operationType: string;
}

/**
 * The selector → relayable-write map behind the transparent gasless mode.
 * Selectors are derived from the shipped v0.8.6 ABIs at module load (never
 * hardcoded), so an ABI change fails loudly here. Gasless is a perps-core-only
 * facility, which makes the shipped ABIs exactly the deployment it targets.
 *
 * The map gates only what the SDK *attempts* — whether the vendor's fee policy
 * accepts a selector is enforced server-side and surfaces as a submit error,
 * so vendor policy never needs to be mirrored here.
 *
 * @internal
 */
export const GASLESS_RELAYABLE_WRITES: ReadonlyMap<Hex, GaslessRelayableWrite> = new Map<Hex, GaslessRelayableWrite>([
  /** AccountLayer._call-proxied core-diamond writes (signerAccount = the sub-account). */
  [selectorFromAbi(symmioAbi as Abi, "allocate"), { target: "symmio", operationType: "allocate" }],
  [selectorFromAbi(symmioAbi as Abi, "deallocate"), { target: "symmio", operationType: "deallocate" }],
  [selectorFromAbi(symmioAbi as Abi, "initiateWithdraw"), { target: "symmio", operationType: "initiateWithdraw" }],
  [
    selectorFromAbi(symmioAbi as Abi, "requestCancelWithdraw"),
    { target: "symmio", operationType: "requestCancelWithdraw" },
  ],
  [
    selectorFromAbi(symmioAbi as Abi, "finalizeWithdrawRequest"),
    { target: "symmio", operationType: "finalizeWithdrawRequest" },
  ],
  [
    selectorFromAbi(symmioAbi as Abi, "requestToCancelQuote"),
    { target: "symmio", operationType: "requestToCancelQuote" },
  ],
  [
    selectorFromAbi(symmioAbi as Abi, "requestToCancelCloseRequest"),
    { target: "symmio", operationType: "requestToCancelCloseRequest" },
  ],
  [selectorFromAbi(symmioAbi as Abi, "forceCancelQuote"), { target: "symmio", operationType: "forceCancelQuote" }],
  [
    selectorFromAbi(symmioAbi as Abi, "forceCancelCloseRequest"),
    { target: "symmio", operationType: "forceCancelCloseRequest" },
  ],
  [selectorFromAbi(symmioAbi as Abi, "forceClosePosition"), { target: "symmio", operationType: "forceClosePosition" }],
  [
    selectorFromAbi(symmioAbi as Abi, "approveOperationalFeeWithMultiplier"),
    { target: "symmio", operationType: "approveOperationalFee" },
  ],
  /**
   * Direct AccountLayer writes. The billing `signerAccount` differs per write:
   * the VA's parent sub-account for margin, the named sub-account for the rest,
   * and `gasless.account` (required) for `createSubAccounts`, whose accounts do
   * not exist yet.
   */
  [selectorFromAbi(accountLayerAbi as Abi, "addMargin"), { target: "accountLayer", operationType: "addMargin" }],
  [selectorFromAbi(accountLayerAbi as Abi, "removeMargin"), { target: "accountLayer", operationType: "removeMargin" }],
  [
    selectorFromAbi(accountLayerAbi as Abi, "createSubAccounts"),
    { target: "accountLayer", operationType: "createSubAccounts" },
  ],
  [
    selectorFromAbi(accountLayerAbi as Abi, "deleteSubAccount"),
    { target: "accountLayer", operationType: "deleteSubAccount" },
  ],
  [
    selectorFromAbi(accountLayerAbi as Abi, "editAccountName"),
    { target: "accountLayer", operationType: "editAccountName" },
  ],
  [
    selectorFromAbi(accountLayerAbi as Abi, "depositForAccount"),
    { target: "accountLayer", operationType: "depositForAccount" },
  ],
  [
    selectorFromAbi(accountLayerAbi as Abi, "depositAndAllocateForAccount"),
    { target: "accountLayer", operationType: "depositAndAllocateForAccount" },
  ],
  /** Direct InstantLayer write (signerAccount = the granting sub-account itself). */
  [
    selectorFromAbi(instantLayerAbi as Abi, "grantDelegation"),
    { target: "instantLayer", operationType: "grantDelegation" },
  ],
]);

/**
 * Every selector the transparent gasless mode can relay.
 *
 * **Not a delegation set.** This list includes `grantDelegation`, because the
 * relayer carries it like any other write — but delegating that selector buys a
 * session key nothing. The InstantLayer routes an operation whose target is the
 * InstantLayer itself to `_verifyGrantOperation`, which reverts unless the
 * signer is the account owner, and `grantDelegation` is `onlyOwner` on top of
 * that: a delegate-signed grant is rejected by the contract outright. Handing a
 * key the selector would only turn a clear "the owner must sign this" into an
 * opaque relay rejection, so no delegation set carries it. To onboard a key,
 * use `getSessionKeySelectors`.
 */
export const GASLESS_RELAYABLE_SELECTORS: readonly Hex[] = [...GASLESS_RELAYABLE_WRITES.keys()];

/**
 * The selectors safe to delegate to a session key for gasless account
 * management — everything a key needs to run an account unattended **except**
 * moving collateral out of it (see {@link GASLESS_SESSION_KEY_WITHDRAW_SELECTORS}).
 *
 * **Enumerated deliberately — never derived from {@link GASLESS_RELAYABLE_WRITES}.**
 * Relayability and delegability are different questions. The first asks whether
 * the relayer will carry a write at all; the second asks whether a browser-held
 * key may sign it with no wallet prompt. Deriving this list from the map would
 * widen a session key's authority every time a write becomes relayable, so each
 * selector is listed here on its own merits.
 *
 * Deliberately absent, though relayable:
 *
 * - `initiateWithdraw` — the one write that picks a destination for the
 *   sub-account's collateral. It lives in
 *   {@link GASLESS_SESSION_KEY_WITHDRAW_SELECTORS}, granted only on an explicit
 *   opt-in.
 * - `createSubAccounts` — the one relayable AccountLayer write with **no**
 *   `onlyAccountOwner` guard, so the InstantLayer's per-account delegation scope
 *   never confines it: a key granted this selector is not bounded to the account
 *   that granted it. It stays owner-signed for that reason, not because creating
 *   an account is sensitive.
 * - `deleteSubAccount` — destroys the account the delegation is scoped to, which
 *   is not a step a key should take unattended.
 * - `depositForAccount` and `depositAndAllocateForAccount` — `CoreFacet` funds
 *   these straight from the signer's own token balance, so they reach collateral
 *   that has not entered the sub-account yet.
 * - `grantDelegation` — the contract rejects a delegate-signed grant (see
 *   {@link GASLESS_RELAYABLE_SELECTORS}), so it would relay only to revert.
 *
 * `editAccountName` and `forceClosePosition` **are** in the set: the first is
 * scope-confined by `onlyAccountOwner` and writes nothing but a bounded display
 * string, and the second is guarded identically to the two force-cancels beside
 * it and can only finish a close the owner already initiated.
 *
 * Pair it with `grantDelegation` (itself relayable, so the onboarding grant
 * needs no gas either) to give a key promptless account management. In an app
 * that also trades, prefer `getSessionKeySelectors`, which unions this set with
 * the trade lifecycle and resolves the chain's contracts generation for you.
 *
 * @example
 * ```ts
 * await grantDelegation(config, {
 *   account: { addr: subAccount, isPartyB: false },
 *   delegatedSigner: sessionKey,
 *   selectors: GASLESS_SESSION_KEY_SELECTORS,
 *   expiryTimestamp,
 *   gasless: true,
 * });
 * ```
 */
export const GASLESS_SESSION_KEY_SELECTORS: readonly Hex[] = [
  selectorFromAbi(symmioAbi as Abi, "allocate"),
  selectorFromAbi(symmioAbi as Abi, "deallocate"),
  selectorFromAbi(symmioAbi as Abi, "requestCancelWithdraw"),
  selectorFromAbi(symmioAbi as Abi, "finalizeWithdrawRequest"),
  selectorFromAbi(symmioAbi as Abi, "requestToCancelQuote"),
  selectorFromAbi(symmioAbi as Abi, "requestToCancelCloseRequest"),
  selectorFromAbi(symmioAbi as Abi, "forceCancelQuote"),
  selectorFromAbi(symmioAbi as Abi, "forceCancelCloseRequest"),
  selectorFromAbi(symmioAbi as Abi, "forceClosePosition"),
  selectorFromAbi(symmioAbi as Abi, "approveOperationalFeeWithMultiplier"),
  selectorFromAbi(accountLayerAbi as Abi, "addMargin"),
  selectorFromAbi(accountLayerAbi as Abi, "removeMargin"),
  selectorFromAbi(accountLayerAbi as Abi, "editAccountName"),
];

/**
 * The withdrawal authority a session key only gets on an explicit opt-in:
 * `initiateWithdraw`, and nothing else.
 *
 * It is split out of {@link GASLESS_SESSION_KEY_SELECTORS} because it is the one
 * delegable write that names a destination.
 * `initiateWithdraw(WithdrawPart[] parts, bool speedUp, bytes data)` carries a
 * caller-supplied `receiver` in every part, so a key holding this selector can
 * send the sub-account's collateral to an address of its own choosing — that is
 * authority over the funds, not merely over the account's bookkeeping.
 *
 * The other two withdrawal writes stay in the base set precisely because they
 * cannot do that: `finalizeWithdrawRequest(address user, uint256 requestId)` and
 * `requestCancelWithdraw(uint256 requestId)` take no receiver at all. They can
 * only settle or cancel a request whose destination an owner-signed
 * `initiateWithdraw` already fixed, so the worst a key can do with them is
 * complete or unwind a transfer the owner authorized.
 *
 * Grant it when a key must run withdrawals end to end unattended, and treat the
 * grant as what it is: the key can drain the sub-account until the delegation
 * expires or is revoked.
 *
 * @example
 * ```ts
 * await grantDelegation(config, {
 *   account: { addr: subAccount, isPartyB: false },
 *   delegatedSigner: sessionKey,
 *   selectors: [...GASLESS_SESSION_KEY_SELECTORS, ...GASLESS_SESSION_KEY_WITHDRAW_SELECTORS],
 *   expiryTimestamp,
 *   gasless: true,
 * });
 * ```
 */
export const GASLESS_SESSION_KEY_WITHDRAW_SELECTORS: readonly Hex[] = [
  selectorFromAbi(symmioAbi as Abi, "initiateWithdraw"),
];

/**
 * Whether a calldata selector is relayable by the transparent gasless mode.
 *
 * @param selector - A `0x`-prefixed 4-byte selector (calldata's first 4 bytes).
 * @returns `true` when the gasless dispatcher would attempt to relay it.
 *
 * @example
 * ```ts
 * isGaslessRelayableSelector(calldata.slice(0, 10) as Hex);
 * ```
 */
export function isGaslessRelayableSelector(selector: Hex): boolean {
  return GASLESS_RELAYABLE_WRITES.has(selector.toLowerCase() as Hex);
}
