import type { SingleUpnlSig } from "@theoldvarorg/core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useDeallocateUpnlSig } from "./use-deallocate-upnl-sig";

const getDeallocateUpnlSig = vi.hoisted(() => vi.fn());

vi.mock("@theoldvarorg/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@theoldvarorg/core")>();
  return { ...actual, getDeallocateUpnlSig };
});

const VIRTUAL_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const UPNL_SIG: SingleUpnlSig = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  upnl: -25_000000000000000000n,
  gatewaySignature: "0xabcd",
  sigs: {
    signature: 99n,
    owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  },
};

describe("useDeallocateUpnlSig", () => {
  afterEach(() => {
    getDeallocateUpnlSig.mockReset();
  });

  it("fetches and returns the assembled uPnL signature on demand", async () => {
    const { config } = createMockSymmioConfig();
    getDeallocateUpnlSig.mockResolvedValueOnce(UPNL_SIG);

    const { result } = renderHookWithProviders(() => useDeallocateUpnlSig({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT });
    });

    expect(res).toEqual(UPNL_SIG);
    expect(getDeallocateUpnlSig).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ virtualAccount: VIRTUAL_ACCOUNT }),
    );
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    getDeallocateUpnlSig.mockRejectedValueOnce(new Error("muon down"));

    const { result } = renderHookWithProviders(() => useDeallocateUpnlSig({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT });
      } catch (err) {
        error = err;
      }
    });

    expect(error).toHaveProperty("kind");
  });
});
