import type { GetMuonUpnlReturnType } from "@symm-frontier/core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMuonUpnl } from "./use-muon-upnl";

const getMuonUpnl = vi.hoisted(() => vi.fn());

vi.mock("@symm-frontier/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symm-frontier/core")>();
  return { ...actual, getMuonUpnl };
});

const PARTY_B: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RESULT: GetMuonUpnlReturnType = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  signature: 99n,
  gatewaySignature: "0xabcd",
  partyB: PARTY_B,
  partyA: PARTY_A,
  uPnlA: -25_000000000000000000n,
  uPnlB: 25_000000000000000000n,
  notionalValueSumA: 1_000_000000000000000000n,
  notionalValueSumB: 2_000_000000000000000000n,
  quoteIdsA: [10n, 11n],
  quoteIdsB: [20n, 21n],
};

describe("useMuonUpnl", () => {
  afterEach(() => {
    getMuonUpnl.mockReset();
  });

  it("fetches and returns the normalized attestation on demand", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnl.mockResolvedValueOnce(RESULT);

    const { result } = renderHookWithProviders(() => useMuonUpnl({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ partyB: PARTY_B, partyA: PARTY_A });
    });

    expect(res).toEqual(RESULT);
    expect(getMuonUpnl).toHaveBeenCalledWith(config, expect.objectContaining({ partyB: PARTY_B, partyA: PARTY_A }));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnl.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useMuonUpnl({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ partyB: PARTY_B, partyA: PARTY_A });
      } catch (err) {
        error = err;
      }
    });

    expect(error).toHaveProperty("kind");
  });
});
