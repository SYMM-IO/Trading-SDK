import { toFunctionSelector, type Abi, type AbiFunction, type Hex } from "viem";
import { accountLayerAbi } from "../../../symmio-contracts/abi/v0.8.5/account-layer";
import { symmioAbi } from "../../../symmio-contracts/abi/v0.8.5/symmio";

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
 * 4-byte function selector for `Symmio.sendQuoteWithAffiliateAndData(...)`.
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
 * The full set of selectors a session key needs delegation for in order to
 * sign the InstantLayer v2 trade lifecycle on behalf of a sub-account: open
 * (`sendQuoteWithAffiliateAndData`), close (`requestToClosePosition`), and
 * margin top-up (`addMarginToNextVA`). Pass to `grantDelegation` in one
 * transaction.
 *
 * @example
 * ```ts
 * grantDelegation(config, {
 *   account: { addr: subAccountAddress, isPartyB: false },
 *   delegatedSigner: sessionKeyAddress,
 *   selectors: INSTANT_TRADE_REQUIRED_SELECTORS,
 *   expiryTimestamp,
 * });
 * ```
 */
export const INSTANT_TRADE_REQUIRED_SELECTORS = [
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
] as const;

