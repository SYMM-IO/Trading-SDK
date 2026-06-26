import { getChainConfig, symmioAbi, SymmioSupportedChainId, type SingleUpnlSig } from "@symm-frontier/core";
import { act, waitFor } from "@testing-library/react";
import { encodeFunctionData, type Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateDeallocate } from "./use-simulate-deallocate";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";
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

describe("useSimulateDeallocate", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateDeallocate({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates the routed `_call` carrying the encoded deallocate", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateDeallocate({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG });
    });

    expect(res).toBeDefined();
    const call = simulateContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args).toEqual([SUB_ACCOUNT, [EXPECTED_DATA]]);
  });

  it("uses an explicit `from` override when provided", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateDeallocate({ config }));

    await act(async () => {
      await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG, from: FROM });
    });

    expect(simulateContract.mock.calls[0]![0].account).toBe(FROM);
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateDeallocate({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
