"use client";

import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  GASLESS_SESSION_KEY_SELECTORS,
  GASLESS_SESSION_KEY_WITHDRAW_SELECTORS,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
} from "@symmio/trading-react";
import { keccak256, slice, toBytes, toFunctionSelector, type Hex } from "viem";

/**
 * The three authority groups a session-key grant is built from, matching the
 * `trade` / `account` / `withdraw` flags of `getSessionKeySelectors`.
 */
export type SessionKeyScopeName = "trade" | "account" | "withdraw";

/** What one delegable selector is called on-chain, and what holding it lets a key do. */
interface SelectorLabel {
  /** The function name exactly as the shipped perps-core v0.8.6 ABI declares it. */
  name: string;
  /** One line on the authority the selector carries, for the picker's subtitle. */
  purpose: string;
}

/**
 * Label a selector the SDK already exports as a named constant. The constant is
 * derived from the ABI inside `@symmio/trading-core`, so it is the strongest key
 * available and is preferred wherever one exists.
 */
function byConstant(selector: Hex, name: string, purpose: string): [string, SelectorLabel] {
  return [selector.toLowerCase(), { name, purpose }];
}

/**
 * Label a selector the SDK only ships inside a bulk set, by its full ABI
 * signature.
 *
 * Deriving the `bytes4` from the signature rather than pasting the hex keeps
 * every entry checkable against the ABI by eye, and makes the failure mode safe:
 * a signature that ever drifts from the deployed contract simply stops matching,
 * so the UI falls back to the raw selector instead of naming the wrong authority.
 */
function bySignature(signature: string, purpose: string): [string, SelectorLabel] {
  return [toFunctionSelector(signature), { name: signature.slice(0, signature.indexOf("(")), purpose }];
}

/**
 * The preimage of the gasless wallet-execution sentinel. It is not an ABI
 * function — the GaslessLayer hashes this literal — so it is derived from the
 * preimage rather than a signature, and it belongs to no `getSessionKeySelectors`
 * scope. A key must hold it before it may sign any delegated wallet batch.
 */
const WALLET_EXECUTION_SENTINEL = "GASLESSQ_WALLET_EXECUTION";

/**
 * Every selector this app can put in front of a user, named and explained.
 *
 * The ABIs live in `@symmio/trading-core` and `apps/web` must not import them,
 * so each entry is pinned to the selector it names — by the SDK's own exported
 * constant where there is one, and by the v0.8.6 ABI signature otherwise.
 * Anything absent from this map renders as its raw `bytes4`, which is the honest
 * thing to show: an invented name would mislabel authority.
 */
const SELECTOR_LABELS: ReadonlyMap<string, SelectorLabel> = new Map([
  /** Trade lifecycle. */
  byConstant(SEND_QUOTE_SELECTOR, "sendQuote", "opens a position"),
  byConstant(
    SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
    "sendQuoteWithAffiliateAndData",
    "opens a position on a 0.8.5 chain",
  ),
  byConstant(REQUEST_TO_CLOSE_POSITION_SELECTOR, "requestToClosePosition", "closes a position"),
  byConstant(ADD_MARGIN_TO_NEXT_VA_SELECTOR, "addMarginToNextVA", "funds the margin of the position being opened"),
  /** Account management on the core diamond, routed through `AccountLayer._call`. */
  bySignature("allocate(uint256)", "moves collateral into the tradeable balance"),
  bySignature(
    "deallocate(uint256,(bytes,uint256,int256,bytes,(uint256,address,address)))",
    "moves collateral back out of the tradeable balance",
  ),
  bySignature("requestCancelWithdraw(uint256)", "cancels a withdrawal the owner started"),
  bySignature("finalizeWithdrawRequest(address,uint256)", "settles a withdrawal the owner already addressed"),
  bySignature("requestToCancelQuote(uint256)", "cancels a resting order"),
  bySignature("requestToCancelCloseRequest(uint256)", "cancels a resting close"),
  bySignature("forceCancelQuote(uint256)", "forces a cancel the solver stalled on"),
  bySignature("forceCancelCloseRequest(uint256)", "forces a close-cancel the solver stalled on"),
  bySignature(
    "forceClosePosition(uint256,(bytes,uint256,uint256,uint256,uint256,uint256,uint256,uint256,int256,int256,uint256,bytes,(uint256,address,address)))",
    "forces a close the solver stalled on",
  ),
  bySignature("approveOperationalFeeWithMultiplier(address[],uint256[],uint256[])", "sets the gasless fee allowance"),
  /** Account management written straight to the AccountLayer. */
  bySignature("addMargin(address,uint256)", "adds margin to a virtual account"),
  bySignature(
    "removeMargin(address,uint256,(bytes,uint256,int256,bytes,(uint256,address,address)))",
    "takes margin back out of a virtual account",
  ),
  bySignature("editAccountName(address,string)", "renames the sub-account"),
  /** The opt-in withdrawal authority. */
  bySignature(
    "initiateWithdraw((uint256,uint256,int256,bytes,address,address)[],bool,bytes)",
    "grants collateral exit",
  ),
  /** Gasless wallet execution. */
  [
    slice(keccak256(toBytes(WALLET_EXECUTION_SENTINEL)), 0, 4),
    { name: WALLET_EXECUTION_SENTINEL, purpose: "lets the key sign wallet batches at all" },
  ],
]);

const ACCOUNT_SELECTORS: ReadonlySet<string> = new Set(
  GASLESS_SESSION_KEY_SELECTORS.map((selector) => selector.toLowerCase()),
);

const WITHDRAW_SELECTORS: ReadonlySet<string> = new Set(
  GASLESS_SESSION_KEY_WITHDRAW_SELECTORS.map((selector) => selector.toLowerCase()),
);

/**
 * Label one selector for display: its contract method name when this app knows
 * one, and the raw `bytes4` otherwise.
 */
export function describeSelector(selector: Hex): string {
  return SELECTOR_LABELS.get(selector.toLowerCase())?.name ?? selector;
}

/**
 * One line on what holding a selector lets a session key do, or `undefined` for
 * a selector this app cannot name.
 */
export function describeSelectorPurpose(selector: Hex): string | undefined {
  return SELECTOR_LABELS.get(selector.toLowerCase())?.purpose;
}

/**
 * Which authority group a selector belongs to. `withdraw` is checked first so
 * `initiateWithdraw` never reads as ordinary account management.
 */
export function getSelectorScope(selector: Hex): SessionKeyScopeName {
  const normalized = selector.toLowerCase();
  if (WITHDRAW_SELECTORS.has(normalized)) return "withdraw";
  if (ACCOUNT_SELECTORS.has(normalized)) return "account";
  return "trade";
}
