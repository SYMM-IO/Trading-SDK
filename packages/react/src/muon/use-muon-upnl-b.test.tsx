import { act } from "@testing-library/react";
import type { GetMuonUpnlBReturnType } from "@theoldvarorg/core";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMuonUpnlB } from "./use-muon-upnl-b";

const getMuonUpnlB = vi.hoisted(() => vi.fn());

vi.mock("@theoldvarorg/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@theoldvarorg/core")>();
  return { ...actual, getMuonUpnlB };
});

const PARTY_B: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RESULT: GetMuonUpnlBReturnType = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  signature: 99n,
  gatewaySignature: "0xabcd",
  partyB: PARTY_B,
  partyA: PARTY_A,
  uPnl: -25_000000000000000000n,
  notionalValueSum: 1_000_000000000000000000n,
  quoteIds: [10n, 11n],
};

describe("useMuonUpnlB", () => {
  afterEach(() => {
    getMuonUpnlB.mockReset();
  });

  it("fetches and returns the normalized attestation on demand", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnlB.mockResolvedValueOnce(RESULT);

    const { result } = renderHookWithProviders(() => useMuonUpnlB({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ partyB: PARTY_B, partyA: PARTY_A });
    });

    expect(res).toEqual(RESULT);
    expect(getMuonUpnlB).toHaveBeenCalledWith(config, expect.objectContaining({ partyB: PARTY_B, partyA: PARTY_A }));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnlB.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useMuonUpnlB({ config }));

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
