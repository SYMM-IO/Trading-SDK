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
 * relayer carries it like any other write — but granting that selector to a
 * session key would let the key mint further delegations for itself, over any
 * selector and any expiry, which defeats the point of a bounded session key.
 * To onboard a key, use {@link GASLESS_SESSION_KEY_SELECTORS}.
 */
export const GASLESS_RELAYABLE_SELECTORS: readonly Hex[] = [...GASLESS_RELAYABLE_WRITES.keys()];

/**
 * The selectors safe to delegate to a session key for gasless account
 * management.
 *
 * **Enumerated deliberately — never derived from {@link GASLESS_RELAYABLE_WRITES}.**
 * Relayability and delegability are different questions. The first asks whether
 * the relayer will carry a write at all; the second asks whether a browser-held
 * key may sign it with no wallet prompt. Deriving this list from the map would
 * widen a session key's authority every time a write becomes relayable, so each
 * selector is listed here on its own merits — and `grantDelegation` is never one
 * of them, since a key that can mint delegations can grant itself any selector
 * and any expiry.
 *
 * Deliberately absent, though relayable: `createSubAccounts`, `deleteSubAccount`,
 * `editAccountName`, `depositForAccount`, `depositAndAllocateForAccount` and
 * `forceClosePosition`. Those relay without native gas but stay owner-signed.
 *
 * Pair it with `grantDelegation` (itself relayable, so the onboarding grant
 * needs no gas either) to give a key promptless account management.
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
  selectorFromAbi(symmioAbi as Abi, "initiateWithdraw"),
  selectorFromAbi(symmioAbi as Abi, "requestCancelWithdraw"),
  selectorFromAbi(symmioAbi as Abi, "finalizeWithdrawRequest"),
  selectorFromAbi(symmioAbi as Abi, "requestToCancelQuote"),
  selectorFromAbi(symmioAbi as Abi, "requestToCancelCloseRequest"),
  selectorFromAbi(symmioAbi as Abi, "forceCancelQuote"),
  selectorFromAbi(symmioAbi as Abi, "forceCancelCloseRequest"),
  selectorFromAbi(symmioAbi as Abi, "approveOperationalFeeWithMultiplier"),
  selectorFromAbi(accountLayerAbi as Abi, "addMargin"),
  selectorFromAbi(accountLayerAbi as Abi, "removeMargin"),
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
