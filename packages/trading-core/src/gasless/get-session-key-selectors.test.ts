import { toFunctionSelector, type AbiFunction } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { SymmError } from "../shared/errors/symm-error";
import { mockConfig } from "../shared/test/mock-config";
import {
  INSTANT_TRADE_REQUIRED_SELECTORS,
  LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS,
} from "../solvers/instant-open/shared/selectors";
import { instantLayerAbi } from "../symmio-contracts/abi/v0.8.6/instant-layer";
import { getSessionKeySelectors } from "./get-session-key-selectors";
import { GASLESS_SESSION_KEY_SELECTORS, GASLESS_SESSION_KEY_WITHDRAW_SELECTORS } from "./relayable-writes";

/** The 0.8.6 chain in the registry, and the 0.8.5 one it must not be confused with. */
const V086_CHAIN = SymmioSupportedChainId.ARBITRUM;
const V085_CHAIN = SymmioSupportedChainId.HYPER_EVM;

const GRANT_DELEGATION_SELECTOR = toFunctionSelector(
  instantLayerAbi.find((item) => item.type === "function" && item.name === "grantDelegation") as AbiFunction,
);

describe("getSessionKeySelectors", () => {
  it("defaults to account management plus the trade lifecycle, in that order", () => {
    const { config } = mockConfig();

    const selectors = getSessionKeySelectors(config, { chainId: V086_CHAIN });

    expect(selectors).toEqual([...GASLESS_SESSION_KEY_SELECTORS, ...INSTANT_TRADE_REQUIRED_SELECTORS]);
  });

  it("leaves the withdrawal authority out unless it is asked for", () => {
    const { config } = mockConfig();

    const selectors = getSessionKeySelectors(config, { chainId: V086_CHAIN });

    for (const selector of GASLESS_SESSION_KEY_WITHDRAW_SELECTORS) {
      expect(selectors).not.toContain(selector);
    }
  });

  it("adds the withdrawal authority between the account and trade blocks on opt-in", () => {
    const { config } = mockConfig();

    const selectors = getSessionKeySelectors(config, { chainId: V086_CHAIN, withdraw: true });

    expect(selectors).toEqual([
      ...GASLESS_SESSION_KEY_SELECTORS,
      ...GASLESS_SESSION_KEY_WITHDRAW_SELECTORS,
      ...INSTANT_TRADE_REQUIRED_SELECTORS,
    ]);
  });

  it("drops the account block when only the trade lifecycle is asked for", () => {
    const { config } = mockConfig();

    const selectors = getSessionKeySelectors(config, { chainId: V086_CHAIN, account: false });

    expect(selectors).toEqual([...INSTANT_TRADE_REQUIRED_SELECTORS]);
  });

  it("drops the trade block when only account management is asked for", () => {
    const { config } = mockConfig();

    const selectors = getSessionKeySelectors(config, { chainId: V086_CHAIN, trade: false });

    expect(selectors).toEqual([...GASLESS_SESSION_KEY_SELECTORS]);
  });

  it("returns an empty set when every scope is opted out", () => {
    const { config } = mockConfig();

    expect(getSessionKeySelectors(config, { chainId: V086_CHAIN, trade: false, account: false })).toEqual([]);
  });

  it("still grants the withdrawal authority when the account scope is off", () => {
    const { config } = mockConfig();

    const selectors = getSessionKeySelectors(config, {
      chainId: V086_CHAIN,
      trade: false,
      account: false,
      withdraw: true,
    });

    expect(selectors).toEqual([...GASLESS_SESSION_KEY_WITHDRAW_SELECTORS]);
  });

  it("returns a de-duplicated, lowercase set", () => {
    const { config } = mockConfig();

    const selectors = getSessionKeySelectors(config, { chainId: V086_CHAIN, withdraw: true });

    expect(new Set(selectors).size).toBe(selectors.length);
    for (const selector of selectors) {
      expect(selector).toBe(selector.toLowerCase());
    }
  });

  it("never grants grantDelegation, in any scope", () => {
    /**
     * The contract routes a self-targeted operation to `_verifyGrantOperation`,
     * which reverts unless the signer is the account owner, so a delegated grant
     * selector could only ever produce an opaque relay rejection.
     */
    const { config } = mockConfig();

    const selectors = getSessionKeySelectors(config, { chainId: V086_CHAIN, withdraw: true });

    expect(selectors).not.toContain(GRANT_DELEGATION_SELECTOR);
  });

  describe("on a chain that predates the perps-core contracts", () => {
    it("rejects the account scope, whose selectors do not exist on that diamond", () => {
      const { config } = mockConfig();

      expect(() => getSessionKeySelectors(config, { chainId: V085_CHAIN })).toThrowError(SymmError);
      try {
        getSessionKeySelectors(config, { chainId: V085_CHAIN });
        expect.unreachable("expected a typed contracts-version error");
      } catch (error) {
        expect((error as SymmError).kind).toBe("config");
        expect((error as SymmError).code).toBe("SESSION_KEY_SELECTORS_UNSUPPORTED_CHAIN");
      }
    });

    it("rejects the withdraw scope for the same reason, even with the account scope off", () => {
      const { config } = mockConfig();

      expect(() =>
        getSessionKeySelectors(config, { chainId: V085_CHAIN, trade: false, account: false, withdraw: true }),
      ).toThrowError(SymmError);
    });

    it("still resolves a trade-only key, on the legacy open-leg selector", () => {
      const { config } = mockConfig();

      const selectors = getSessionKeySelectors(config, { chainId: V085_CHAIN, account: false });

      expect(selectors).toEqual([...LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS]);
      expect(selectors).not.toEqual([...INSTANT_TRADE_REQUIRED_SELECTORS]);
    });
  });
});
