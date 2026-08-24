import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../core/chains";
import { createConfig } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import { resolveListingService, supportsListingService } from "./resolve-listing";

const HYPEREVM = SymmioSupportedChainId.HYPER_EVM;
const BASE = SymmioSupportedChainId.BASE;
const LISTING_URL = getChainConfig(HYPEREVM).listing?.url;

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("resolveListingService", () => {
  it("returns the chain's listing backend for the enigma solver on HyperEVM", () => {
    expect(LISTING_URL).toBe("https://listing85.enigma.bz/v2");
    expect(resolveListingService(config, { chainId: HYPEREVM })).toEqual({ url: LISTING_URL });
    expect(resolveListingService(config, { chainId: HYPEREVM, solverId: "enigma" }).url).toBe(LISTING_URL);
  });

  it("throws LISTING_UNSUPPORTED when the solver does not use the listing service", () => {
    // Base's default solver is rasa, which does not declare `listingService`.
    const error = getThrown(() => resolveListingService(config, { chainId: BASE }));
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).code).toBe("LISTING_UNSUPPORTED");
  });

  it("throws LISTING_NOT_CONFIGURED when the solver opts in but the chain has no listing backend", () => {
    // Force rasa on Base to declare the capability; Base still has no `listing` block.
    const optedIn = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [BASE]: {
          addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
          solvers: { rasa: { capabilities: { listingService: true } } },
        },
      },
    });
    const error = getThrown(() => resolveListingService(optedIn, { chainId: BASE }));
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).code).toBe("LISTING_NOT_CONFIGURED");
  });
});

describe("supportsListingService", () => {
  it("is true for the enigma solver on HyperEVM", () => {
    expect(supportsListingService(config, { chainId: HYPEREVM })).toBe(true);
  });

  it("is false for a solver that does not use the listing service", () => {
    expect(supportsListingService(config, { chainId: BASE })).toBe(false);
  });

  it("is false (never throws) for an unknown chain", () => {
    expect(supportsListingService(config, { chainId: 1 })).toBe(false);
  });
});

/** Capture a thrown value without asserting on control flow. */
function getThrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}
