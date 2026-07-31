import type { HighLowPriceSig } from "@symmio/trading-core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useForceClosePriceSig } from "./use-force-close-price-sig";

const getForceClosePriceSig = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getForceClosePriceSig };
});

const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PARTY_B: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const VARIABLES = { partyA: PARTY_A, partyB: PARTY_B, symbolId: 7n, t0: 1_700_000_000n, t1: 1_700_003_600n };
const PRICE_SIG: HighLowPriceSig = {
  reqId: "0x1234",
  timestamp: 1_700_003_600n,
  symbolId: 7n,
  highest: 52_000000000000000000n,
  lowest: 48_000000000000000000n,
  averagePrice: 50_000000000000000000n,
  startTime: 1_700_000_000n,
  endTime: 1_700_003_600n,
  upnlPartyB: 25_000000000000000000n,
  upnlPartyA: -25_000000000000000000n,
  currentPrice: 49_000000000000000000n,
  gatewaySignature: "0xabcd",
  sigs: {
    signature: 99n,
    owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  },
};

describe("useForceClosePriceSig", () => {
  afterEach(() => {
    getForceClosePriceSig.mockReset();
  });

  it("fetches and returns the assembled price-range signature on demand", async () => {
    const { config } = createMockSymmioConfig();
    getForceClosePriceSig.mockResolvedValueOnce(PRICE_SIG);

    const { result } = renderHookWithProviders(() => useForceClosePriceSig({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARIABLES);
    });

    expect(res).toEqual(PRICE_SIG);
    expect(getForceClosePriceSig).toHaveBeenCalledWith(config, expect.objectContaining(VARIABLES));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getForceClosePriceSig.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useForceClosePriceSig({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(VARIABLES);
      } catch (err) {
        error = err;
      }
    });

    expect(error).toHaveProperty("kind");
  });
});
