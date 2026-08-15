import type { SingleUpnlAndPriceSig } from "@symmio/trading-core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSendQuoteUpnlSig } from "./use-send-quote-upnl-sig";

const getSendQuoteUpnlSig = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSendQuoteUpnlSig };
});

const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SYMBOL_ID = 7n;
const UPNL_SIG: SingleUpnlAndPriceSig = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  upnl: -25_000000000000000000n,
  price: 50_000000000000000000n,
  gatewaySignature: "0xabcd",
  sigs: {
    signature: 99n,
    owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  },
};

describe("useSendQuoteUpnlSig", () => {
  afterEach(() => {
    getSendQuoteUpnlSig.mockReset();
  });

  it("fetches and returns the assembled uPnL + price signature on demand", async () => {
    const { config } = createMockSymmioConfig();
    getSendQuoteUpnlSig.mockResolvedValueOnce(UPNL_SIG);

    const { result } = renderHookWithProviders(() => useSendQuoteUpnlSig({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ partyA: PARTY_A, symbolId: SYMBOL_ID });
    });

    expect(res).toEqual(UPNL_SIG);
    expect(getSendQuoteUpnlSig).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ partyA: PARTY_A, symbolId: SYMBOL_ID }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getSendQuoteUpnlSig.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useSendQuoteUpnlSig({ config }));

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
