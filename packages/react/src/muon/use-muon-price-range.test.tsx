import type { GetMuonPriceRangeReturnType } from "@symm-frontier/core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMuonPriceRange } from "./use-muon-price-range";

const getMuonPriceRange = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getMuonPriceRange };
});

const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PARTY_B: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const VARIABLES = { t0: 1_700_000_000n, t1: 1_700_000_900n, partyA: PARTY_A, partyB: PARTY_B, symbolId: 1n };
const RESULT: GetMuonPriceRangeReturnType = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  signature: 99n,
  gatewaySignature: "0xabcd",
  partyA: PARTY_A,
  partyB: PARTY_B,
  symbolId: 1n,
  startTime: 1_700_000_000n,
  endTime: 1_700_000_900n,
  lowest: 1_990_000000000000000000n,
  highest: 2_010_000000000000000000n,
  mean: 2_000_000000000000000000n,
  price: 2_005_000000000000000000n,
  uPnlA: -25_000000000000000000n,
  uPnlB: 25_000000000000000000n,
};

describe("useMuonPriceRange", () => {
  afterEach(() => {
    getMuonPriceRange.mockReset();
  });

  it("fetches and returns the normalized attestation on demand", async () => {
    const { config } = createMockSymmioConfig();
    getMuonPriceRange.mockResolvedValueOnce(RESULT);

    const { result } = renderHookWithProviders(() => useMuonPriceRange({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARIABLES);
    });

    expect(res).toEqual(RESULT);
    expect(getMuonPriceRange).toHaveBeenCalledWith(config, expect.objectContaining(VARIABLES));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMuonPriceRange.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useMuonPriceRange({ config }));

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
