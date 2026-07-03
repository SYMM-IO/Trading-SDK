import type { GetMuonUpnlAWithSymbolPriceReturnType } from "@symmio/trading-core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMuonUpnlAWithSymbolPrice } from "./use-muon-upnl-a-with-symbol-price";

const getMuonUpnlAWithSymbolPrice = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getMuonUpnlAWithSymbolPrice };
});

const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SYMBOL_ID = 7n;
const RESULT: GetMuonUpnlAWithSymbolPriceReturnType = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  signature: 99n,
  gatewaySignature: "0xabcd",
  partyA: PARTY_A,
  symbolId: SYMBOL_ID,
  price: 42_000000000000000000n,
  uPnl: -25_000000000000000000n,
  notionalValueSum: 1_000_000000000000000000n,
  symbolIds: [1n, 2n],
  quoteIds: [10n, 11n],
};

describe("useMuonUpnlAWithSymbolPrice", () => {
  afterEach(() => {
    getMuonUpnlAWithSymbolPrice.mockReset();
  });

  it("fetches and returns the normalized attestation on demand", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnlAWithSymbolPrice.mockResolvedValueOnce(RESULT);

    const { result } = renderHookWithProviders(() => useMuonUpnlAWithSymbolPrice({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ partyA: PARTY_A, symbolId: SYMBOL_ID });
    });

    expect(res).toEqual(RESULT);
    expect(getMuonUpnlAWithSymbolPrice).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ partyA: PARTY_A, symbolId: SYMBOL_ID }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnlAWithSymbolPrice.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useMuonUpnlAWithSymbolPrice({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ partyA: PARTY_A, symbolId: SYMBOL_ID });
      } catch (err) {
        error = err;
      }
    });

    expect(error).toHaveProperty("kind");
  });
});
