"use client";

import {
  getInstantTradeRequiredSelectors,
  type ConfigParameter,
  type INSTANT_TRADE_REQUIRED_SELECTORS,
  type LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS,
} from "@symmio/trading-core";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useInstantTradeRequiredSelectors}. */
export interface UseInstantTradeRequiredSelectorsParameters extends ConfigParameter {
  /** Chain to resolve for; defaults to the connected chain. */
  chainId?: number;
}

/** Return type of {@link useInstantTradeRequiredSelectors}: the chain's selector set. */
export type UseInstantTradeRequiredSelectorsReturnType =
  | typeof INSTANT_TRADE_REQUIRED_SELECTORS
  | typeof LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS;

/**
 * The session-key delegation selector set for the connected (or given) chain,
 * resolved by its `contractsVersion` — `sendQuote` on a perps-core v0.8.6
 * chain, the legacy `sendQuoteWithAffiliateAndData` on v0.8.5.
 *
 * Use this instead of hardcoding `INSTANT_TRADE_REQUIRED_SELECTORS` in any flow
 * that can point at more than one chain: a hardcoded set grants (and checks)
 * the wrong open-leg selector on the other generation's chains.
 *
 * @example
 * ```tsx
 * const selectors = useInstantTradeRequiredSelectors();
 * grantDelegation.mutate({ account, delegatedSigner, selectors, expiryTimestamp });
 * ```
 */
export function useInstantTradeRequiredSelectors(
  parameters: UseInstantTradeRequiredSelectorsParameters = {},
): UseInstantTradeRequiredSelectorsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  return getInstantTradeRequiredSelectors(config, { chainId: parameters.chainId ?? chainId });
}
