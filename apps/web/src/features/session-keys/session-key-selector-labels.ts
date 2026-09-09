"use client";

import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  GASLESS_SESSION_KEY_SELECTORS,
  GASLESS_SESSION_KEY_WITHDRAW_SELECTORS,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
} from "@symmio/trading-react";
import type { Hex } from "viem";

/**
 * The three authority groups a session-key grant is built from, matching the
 * `trade` / `account` / `withdraw` flags of `getSessionKeySelectors`.
 */
export type SessionKeyScopeName = "trade" | "account" | "withdraw";

/**
 * Human-readable names for the selectors the SDK exports by name. Everything
 * else falls back to its raw `bytes4`, which is the honest thing to show: the
 * ABIs live in `@symmio/trading-core` and `apps/web` must not import them
 * directly, so inventing a name here would risk mislabelling authority.
 */
const SELECTOR_NAMES: ReadonlyMap<string, string> = new Map([
  [ADD_MARGIN_TO_NEXT_VA_SELECTOR.toLowerCase(), "addMarginToNextVA"],
  [REQUEST_TO_CLOSE_POSITION_SELECTOR.toLowerCase(), "requestToClosePosition"],
  [SEND_QUOTE_SELECTOR.toLowerCase(), "sendQuote"],
  [SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR.toLowerCase(), "sendQuoteWithAffiliateAndData"],
]);

const ACCOUNT_SELECTORS: ReadonlySet<string> = new Set(
  GASLESS_SESSION_KEY_SELECTORS.map((selector) => selector.toLowerCase()),
);

const WITHDRAW_SELECTORS: ReadonlySet<string> = new Set(
  GASLESS_SESSION_KEY_WITHDRAW_SELECTORS.map((selector) => selector.toLowerCase()),
);

/**
 * Label one selector for display: its SDK name when the SDK exports one, and
 * the raw `bytes4` otherwise.
 */
export function describeSelector(selector: Hex): string {
  return SELECTOR_NAMES.get(selector.toLowerCase()) ?? selector;
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

/** Case-insensitive selector-set difference: everything in `all` that `subset` lacks. */
export function diffSelectors(all: readonly Hex[], subset: readonly Hex[]): readonly Hex[] {
  const held = new Set(subset.map((selector) => selector.toLowerCase()));
  return all.filter((selector) => !held.has(selector.toLowerCase()));
}
