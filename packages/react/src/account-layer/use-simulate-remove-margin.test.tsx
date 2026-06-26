import { getChainConfig, SymmioSupportedChainId, type SingleUpnlSig } from "@theoldvarorg/core";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateRemoveMargin } from "./use-simulate-remove-margin";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const VIRTUAL_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";
const AMOUNT = 50_000000000000000000n;
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

describe("useSimulateRemoveMargin", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateRemoveMargin({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates removeMargin against the AccountLayer with the supplied upnlSig", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateRemoveMargin({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG });
    });

    expect(res).toBeDefined();
    const call = simulateContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("removeMargin");
    expect(call.args).toEqual([VIRTUAL_ACCOUNT, AMOUNT, UPNL_SIG]);
  });

  it("uses an explicit `from` override when provided", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateRemoveMargin({ config }));

    await act(async () => {
      await result.current.mutateAsync({
        virtualAccount: VIRTUAL_ACCOUNT,
        amount: AMOUNT,
        upnlSig: UPNL_SIG,
        from: FROM,
      });
    });

    expect(simulateContract.mock.calls[0]![0].account).toBe(FROM);
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateRemoveMargin({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
