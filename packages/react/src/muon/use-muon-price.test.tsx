import type { GetMuonPriceReturnType } from "@symm-frontier/core";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMuonPrice } from "./use-muon-price";

const getMuonPrice = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getMuonPrice };
});

const QUOTE_IDS = [10n, 11n];
const RESULT: GetMuonPriceReturnType = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  signature: 99n,
  gatewaySignature: "0xabcd",
  quoteIds: [10n, 11n],
  prices: [2_500_000000000000000000n, 1_800000000000000000n],
  markPrices: [2_501_000000000000000000n, 1_801000000000000000n],
  symbols: ["BTCUSDT", "ETHUSDT"],
};

describe("useMuonPrice", () => {
  afterEach(() => {
    getMuonPrice.mockReset();
  });

  it("fetches and returns the normalized attestation on demand", async () => {
    const { config } = createMockSymmioConfig();
    getMuonPrice.mockResolvedValueOnce(RESULT);

    const { result } = renderHookWithProviders(() => useMuonPrice({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ quoteIds: QUOTE_IDS });
    });

    expect(res).toEqual(RESULT);
    expect(getMuonPrice).toHaveBeenCalledWith(config, expect.objectContaining({ quoteIds: QUOTE_IDS }));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMuonPrice.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useMuonPrice({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ quoteIds: QUOTE_IDS });
      } catch (err) {
        error = err;
      }
    });

    expect(error).toHaveProperty("kind");
  });
});
