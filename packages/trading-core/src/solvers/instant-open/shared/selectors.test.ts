import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  getInstantTradeRequiredSelectors,
  INSTANT_TRADE_REQUIRED_SELECTORS,
  LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
} from "./selectors";

describe("getInstantTradeRequiredSelectors", () => {
  it("resolves the legacy set on a v0.8.5 chain (HyperEVM)", () => {
    const { config } = mockConfig();

    const selectors = getInstantTradeRequiredSelectors(config, { chainId: SymmioSupportedChainId.HYPER_EVM });

    expect(selectors).toBe(LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS);
  });

  it("resolves the sendQuote set on a v0.8.6 chain (Arbitrum)", () => {
    const { config } = mockConfig();

    const selectors = getInstantTradeRequiredSelectors(config, { chainId: SymmioSupportedChainId.ARBITRUM });

    expect(selectors).toBe(INSTANT_TRADE_REQUIRED_SELECTORS);
  });

  it("only the open-leg selector differs between the two sets", () => {
    expect(INSTANT_TRADE_REQUIRED_SELECTORS).toEqual([
      ADD_MARGIN_TO_NEXT_VA_SELECTOR,
      SEND_QUOTE_SELECTOR,
      REQUEST_TO_CLOSE_POSITION_SELECTOR,
    ]);
    expect(LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS).toEqual([
      ADD_MARGIN_TO_NEXT_VA_SELECTOR,
      SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
      REQUEST_TO_CLOSE_POSITION_SELECTOR,
    ]);
    expect(SEND_QUOTE_SELECTOR).not.toBe(SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR);
  });
});
