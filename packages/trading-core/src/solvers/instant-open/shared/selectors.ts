import { toFunctionSelector, type Abi, type AbiFunction, type Hex } from "viem";
import type { Config } from "../../../core/config";
import { accountLayerAbi } from "../../../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../../../symmio-contracts/abi/v0.8.6/symmio";

function selectorFromAbi(abi: Abi, name: string): Hex {
  const fragment = abi.find((item) => item.type === "function" && item.name === name) as AbiFunction | undefined;
  if (!fragment) throw new Error(`Selector lookup failed: "${name}" not in ABI.`);
  return toFunctionSelector(fragment);
}

/**
 * 4-byte function selector for `AccountLayer.addMarginToNextVA(...)`.
 *
 * Computed once from the ABI fragment so it stays in sync if the function
 * signature changes in a future ABI version.
 */
export const ADD_MARGIN_TO_NEXT_VA_SELECTOR: Hex = selectorFromAbi(accountLayerAbi as Abi, "addMarginToNextVA");

/**
 * 4-byte function selector for `Symmio.sendQuote(...)` — the perps-core v0.8.6
 * overload carrying `SolverFeeCaps`. This is the selector the Enigma
 * instant-open flow signs, and the one a session key needs delegation for.
 */
export const SEND_QUOTE_SELECTOR: Hex = selectorFromAbi(symmioAbi as Abi, "sendQuote");

/**
 * 4-byte function selector for the legacy `Symmio.sendQuoteWithAffiliateAndData(...)`.
 *
 * Kept for the Rasa flow, which still signs the legacy method (it stores zero
 * solver-fee caps on-chain). The Enigma delegation set uses
 * {@link SEND_QUOTE_SELECTOR} instead.
 */
export const SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR: Hex = selectorFromAbi(
  symmioAbi as Abi,
  "sendQuoteWithAffiliateAndData",
);

/**
 * 4-byte function selector for `Symmio.requestToClosePosition(...)`.
 */
export const REQUEST_TO_CLOSE_POSITION_SELECTOR: Hex = selectorFromAbi(symmioAbi as Abi, "requestToClosePosition");

/**
 * The selectors a session key needs delegation for to sign the InstantLayer v2
 * trade lifecycle on a **perps-core v0.8.6 chain**: open (`sendQuote`), close
 * (`requestToClosePosition`), and margin top-up (`addMarginToNextVA`). Pass to
 * `grantDelegation` in one transaction.
 *
 * **The set is per-chain.** A v0.8.5 chain's open leg is the legacy
 * `sendQuoteWithAffiliateAndData` ({@link LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS});
 * in a flow that serves several chains, resolve the right set with
 * {@link getInstantTradeRequiredSelectors} instead of hardcoding either
 * constant.
 *
 * @example
 * ```ts
 * grantDelegation(config, {
 *   account: { addr: subAccountAddress, isPartyB: false },
 *   delegatedSigner: sessionKeyAddress,
 *   selectors: getInstantTradeRequiredSelectors(config, { chainId }),
 *   expiryTimestamp,
 * });
 * ```
 */
export const INSTANT_TRADE_REQUIRED_SELECTORS = [
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  SEND_QUOTE_SELECTOR,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
] as const;

/**
 * The {@link INSTANT_TRADE_REQUIRED_SELECTORS} counterpart for a **perps-core
 * v0.8.5 chain**, whose open leg is the legacy `sendQuoteWithAffiliateAndData`
 * (the capped `sendQuote` selector does not exist on its diamond).
 */
export const LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS = [
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
] as const;

/**
 * Resolve the session-key delegation selector set for a chain by its
 * `contractsVersion`: {@link INSTANT_TRADE_REQUIRED_SELECTORS} on `"0.8.6"`,
 * {@link LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS} on `"0.8.5"`.
 *
 * Use this (or the `useInstantTradeRequiredSelectors` hook) in any flow that
 * can point at more than one chain — a hardcoded set is wrong on the other
 * generation's chains.
 *
 * @param config - The SDK config.
 * @param parameters - Optional `chainId`; defaults to the config's `defaultChainId`.
 * @returns The selector set matching the chain's contracts generation.
 * @throws {SymmError} `UNSUPPORTED_CHAIN` when the chain is not configured.
 */
export function getInstantTradeRequiredSelectors(
  config: Config,
  parameters: { chainId?: number } = {},
): typeof INSTANT_TRADE_REQUIRED_SELECTORS | typeof LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS {
  return config.getChainConfig(parameters.chainId).contractsVersion === "0.8.5"
    ? LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS
    : INSTANT_TRADE_REQUIRED_SELECTORS;
}
