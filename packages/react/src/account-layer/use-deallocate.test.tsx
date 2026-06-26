import { act } from "@testing-library/react";
import { getChainConfig, symmioAbi, SymmioSupportedChainId, type SingleUpnlSig } from "@theoldvarorg/core";
import { encodeFunctionData, type Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useDeallocate } from "./use-deallocate";

const getDeallocateUpnlSig = vi.hoisted(() => vi.fn());

vi.mock("@theoldvarorg/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@theoldvarorg/core")>();
  return { ...actual, getDeallocateUpnlSig };
});

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AMOUNT = 1_000000000000000000n;
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
const EXPECTED_DATA = encodeFunctionData({ abi: symmioAbi, functionName: "deallocate", args: [AMOUNT, UPNL_SIG] });

describe("useDeallocate", () => {
  afterEach(() => {
    getDeallocateUpnlSig.mockReset();
  });

  it("fetches a fresh uPnL signature then writes deallocate via `_call` when none is supplied", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    getDeallocateUpnlSig.mockResolvedValueOnce(UPNL_SIG);

    const { result } = renderHookWithProviders(() => useDeallocate({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(getDeallocateUpnlSig).toHaveBeenCalledWith(config, expect.objectContaining({ virtualAccount: SUB_ACCOUNT }));
    const call = writeContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args).toEqual([SUB_ACCOUNT, [EXPECTED_DATA]]);
  });

  it("uses a supplied upnlSig without fetching one", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useDeallocate({ config, waitForReceipt: false }));

    await act(async () => {
      await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG });
    });

    expect(getDeallocateUpnlSig).not.toHaveBeenCalled();
    expect(writeContract.mock.calls[0]![0].args).toEqual([SUB_ACCOUNT, [EXPECTED_DATA]]);
  });

  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });

    const { result } = renderHookWithProviders(() => useDeallocate({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG });
      } catch (err) {
        error = err;
      }
    });

    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });
});
