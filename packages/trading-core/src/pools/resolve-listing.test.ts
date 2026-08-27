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
  it("returns the chain's listing backend on HyperEVM", () => {
    /**
     * Host root, **no** `/v2`: the generated client's own paths already start
     * with `/v2`, so a versioned base would request `/v2/v2/market/search` and
     * 404. Asserted here because the value is only exercised at request time.
     */
    expect(LISTING_URL).toBe("https://listing85.enigma.bz");
    expect(resolveListingService(config, { chainId: HYPEREVM })).toEqual({ url: LISTING_URL });
  });

  it("throws LISTING_NOT_CONFIGURED when the chain has no listing backend", () => {
    // Base has no `listing` block configured.
    const error = getThrown(() => resolveListingService(config, { chainId: BASE }));
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).code).toBe("LISTING_NOT_CONFIGURED");
  });
});

describe("supportsListingService", () => {
  it("is true for HyperEVM", () => {
    expect(supportsListingService(config, { chainId: HYPEREVM })).toBe(true);
  });

  it("is false for a chain with no listing backend", () => {
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
