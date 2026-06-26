import { act } from "@testing-library/react";
import type { GetMuonUpnlAReturnType } from "@theoldvarorg/core";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useMuonUpnlA } from "./use-muon-upnl-a";

const getMuonUpnlA = vi.hoisted(() => vi.fn());

vi.mock("@theoldvarorg/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@theoldvarorg/core")>();
  return { ...actual, getMuonUpnlA };
});

const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RESULT: GetMuonUpnlAReturnType = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  signature: 99n,
  gatewaySignature: "0xabcd",
  partyA: PARTY_A,
  uPnl: -25_000000000000000000n,
  notionalValueSum: 1_000_000000000000000000n,
  symbolIds: [1n, 2n],
  quoteIds: [10n, 11n],
};

describe("useMuonUpnlA", () => {
  afterEach(() => {
    getMuonUpnlA.mockReset();
  });

  it("fetches and returns the normalized attestation on demand", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnlA.mockResolvedValueOnce(RESULT);

    const { result } = renderHookWithProviders(() => useMuonUpnlA({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ partyA: PARTY_A });
    });

    expect(res).toEqual(RESULT);
    expect(getMuonUpnlA).toHaveBeenCalledWith(config, expect.objectContaining({ partyA: PARTY_A }));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getMuonUpnlA.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useMuonUpnlA({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ partyA: PARTY_A });
      } catch (err) {
        error = err;
      }
    });

    expect(error).toHaveProperty("kind");
  });
});
