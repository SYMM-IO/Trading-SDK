import { act } from "@testing-library/react";
import type { GetMuonSettleUpnlReturnType } from "@theoldvarorg/core";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMuonSettleUpnl } from "./use-muon-settle-upnl";

const getMuonSettleUpnl = vi.hoisted(() => vi.fn());

vi.mock("@theoldvarorg/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@theoldvarorg/core")>();
  return { ...actual, getMuonSettleUpnl };
});

const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const QUOTE_IDS = [10n, 11n];
const RESULT: GetMuonSettleUpnlReturnType = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  signature: 99n,
  gatewaySignature: "0xabcd",
  partyA: PARTY_A,
  quoteIds: QUOTE_IDS,
  uPnlA: -25_000000000000000000n,
  notionalValueSumA: 1_000_000000000000000000n,
};

describe("useMuonSettleUpnl", () => {
  afterEach(() => {
    getMuonSettleUpnl.mockReset();
  });

  it("fetches and returns the normalized attestation on demand", async () => {
    const { config } = createMockSymmioConfig();
    getMuonSettleUpnl.mockResolvedValueOnce(RESULT);

    const { result } = renderHookWithProviders(() => useMuonSettleUpnl({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ partyA: PARTY_A, quoteIds: QUOTE_IDS });
    });

    expect(res).toEqual(RESULT);
    expect(getMuonSettleUpnl).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ partyA: PARTY_A, quoteIds: QUOTE_IDS }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMuonSettleUpnl.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useMuonSettleUpnl({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ partyA: PARTY_A, quoteIds: QUOTE_IDS });
      } catch (err) {
        error = err;
      }
    });

    expect(error).toHaveProperty("kind");
  });
});
