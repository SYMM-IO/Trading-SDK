import {
  getChainConfig,
  SubAccountIsolationType,
  SymmioSupportedChainId,
  type SingleUpnlSig,
} from "@symmio/trading-core";
import { act } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useWithdraw } from "./use-withdraw";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
// Collateral is 6-decimal (USDC) on the default test chain: 1 USDC.
const COLLATERAL_AMOUNT = 1_000000n;
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

describe("useWithdraw", () => {
  it("resolves a MARKET subaccount's isolation (via useSubAccount) and routes to a single-calldata `_call`", async () => {
    const { config, readContract, writeContract } = createMockSymmioConfig();
    // `useSubAccount` (and the core fallback) read the subaccount's isolation here.
    readContract.mockResolvedValue({ isolationType: SubAccountIsolationType.MARKET });
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() =>
      useWithdraw({ config, account: SUB_ACCOUNT, waitForReceipt: false }),
    );

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ amount: COLLATERAL_AMOUNT, receiver: RECEIVER });
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    const call = writeContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args[0]).toBe(SUB_ACCOUNT);
    expect(call.args[1]).toHaveLength(1);
  });

  it("resolves a CUSTOM subaccount's isolation and routes to a two-calldata `_call` (deallocate + initiate)", async () => {
    const { config, readContract, writeContract } = createMockSymmioConfig();
    readContract.mockResolvedValue({ isolationType: SubAccountIsolationType.CUSTOM });
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() =>
      useWithdraw({ config, account: SUB_ACCOUNT, waitForReceipt: false }),
    );

    await act(async () => {
      // Pass upnlSig so the deallocate leg does not fetch a fresh Muon signature.
      await result.current.mutateAsync({ amount: COLLATERAL_AMOUNT, receiver: RECEIVER, upnlSig: UPNL_SIG });
    });

    const call = writeContract.mock.calls[0]![0];
    expect(call.functionName).toBe("_call");
    expect(call.args[0]).toBe(SUB_ACCOUNT);
    expect(call.args[1]).toHaveLength(2);
  });

  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, readContract, writeContract } = createMockSymmioConfig({ withWallet: false });
    readContract.mockResolvedValue({ isolationType: SubAccountIsolationType.MARKET });

    const { result } = renderHookWithProviders(() => useWithdraw({ config, account: SUB_ACCOUNT }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ amount: COLLATERAL_AMOUNT, receiver: RECEIVER });
      } catch (err) {
        error = err;
      }
    });

    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });
});
