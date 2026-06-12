import type { GetMuonUpnlWithSymbolPriceReturnType } from "@symm-frontier/core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMuonUpnlWithSymbolPrice } from "./use-muon-upnl-with-symbol-price";

const getMuonUpnlWithSymbolPrice = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getMuonUpnlWithSymbolPrice };
});

const PARTY_B: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SYMBOL_ID = 1n;
const RESULT: GetMuonUpnlWithSymbolPriceReturnType = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  signature: 99n,
  gatewaySignature: "0xabcd",
  partyB: PARTY_B,
  partyA: PARTY_A,
  symbolId: SYMBOL_ID,
  price: 2_000000000000000000n,
  uPnlA: -25_000000000000000000n,
  uPnlB: 25_000000000000000000n,
  quoteIdsA: [10n, 11n],
  quoteIdsB: [20n, 21n],
};

describe("useMuonUpnlWithSymbolPrice", () => {
  afterEach(() => {
    getMuonUpnlWithSymbolPrice.mockReset();
  });

  it("fetches and returns the normalized attestation on demand", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnlWithSymbolPrice.mockResolvedValueOnce(RESULT);

    const { result } = renderHookWithProviders(() => useMuonUpnlWithSymbolPrice({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ partyB: PARTY_B, partyA: PARTY_A, symbolId: SYMBOL_ID });
    });

    expect(res).toEqual(RESULT);
    expect(getMuonUpnlWithSymbolPrice).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ partyB: PARTY_B, partyA: PARTY_A, symbolId: SYMBOL_ID }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnlWithSymbolPrice.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useMuonUpnlWithSymbolPrice({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ partyB: PARTY_B, partyA: PARTY_A, symbolId: SYMBOL_ID });
      } catch (err) {
        error = err;
      }
    });

    expect(error).toHaveProperty("kind");
  });
});
