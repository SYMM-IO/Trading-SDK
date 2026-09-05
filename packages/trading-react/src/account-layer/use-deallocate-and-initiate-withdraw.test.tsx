import {
  createClassicWithdrawPart,
  getChainConfig,
  symmioAbi,
  SymmioSupportedChainId,
  type SingleUpnlSig,
} from "@symmio/trading-core";
import { act } from "@testing-library/react";
import { encodeFunctionData, type Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useDeallocateAndInitiateWithdraw } from "./use-deallocate-and-initiate-withdraw";

const getDeallocateUpnlSig = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getDeallocateUpnlSig };
});

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const AMOUNT = 1_000000000000000000n;
const PARTS = [createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: RECEIVER, chainId: 999n })];
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

const EXPECTED_DEALLOCATE = encodeFunctionData({
  abi: symmioAbi,
  functionName: "deallocate",
  args: [AMOUNT, UPNL_SIG],
});
const EXPECTED_WITHDRAW = encodeFunctionData({
  abi: symmioAbi,
  functionName: "initiateWithdraw",
  args: [PARTS, false, "0x"],
});

describe("useDeallocateAndInitiateWithdraw", () => {
  afterEach(() => {
    getDeallocateUpnlSig.mockReset();
  });

  it("fetches a fresh uPnL signature then batches deallocate + initiateWithdraw via `_call`", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    getDeallocateUpnlSig.mockResolvedValueOnce(UPNL_SIG);

    const { result } = renderHookWithProviders(() =>
      useDeallocateAndInitiateWithdraw({ config, waitForReceipt: false }),
    );

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, parts: PARTS });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(getDeallocateUpnlSig).toHaveBeenCalledWith(config, expect.objectContaining({ virtualAccount: SUB_ACCOUNT }));
    const call = writeContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args).toEqual([SUB_ACCOUNT, [EXPECTED_DEALLOCATE, EXPECTED_WITHDRAW]]);
  });

  it("uses a supplied upnlSig without fetching one", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() =>
      useDeallocateAndInitiateWithdraw({ config, waitForReceipt: false }),
    );

    await act(async () => {
      await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, parts: PARTS, upnlSig: UPNL_SIG });
    });

    expect(getDeallocateUpnlSig).not.toHaveBeenCalled();
    expect(writeContract.mock.calls[0]![0].args).toEqual([SUB_ACCOUNT, [EXPECTED_DEALLOCATE, EXPECTED_WITHDRAW]]);
  });

  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });

    const { result } = renderHookWithProviders(() => useDeallocateAndInitiateWithdraw({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, parts: PARTS, upnlSig: UPNL_SIG });
      } catch (err) {
        error = err;
      }
    });

    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });
});
