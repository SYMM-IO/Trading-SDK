import { getChainConfig, SymmioSupportedChainId } from "@theoldvarorg/core";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateAllocate } from "./use-simulate-allocate";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";
const AMOUNT = 1_000000000000000000n;

describe("useSimulateAllocate", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateAllocate({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates the routed `_call` carrying the encoded allocate", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: ["0x"], request: {} });

    const { result } = renderHookWithProviders(() => useSimulateAllocate({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT });
    });

    expect((res as { result: unknown }).result).toEqual(["0x"]);
    const call = simulateContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args[0]).toBe(SUB_ACCOUNT);
    expect(call.args[1]).toHaveLength(1);
  });

  it("uses an explicit `from` override when provided", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: ["0x"], request: {} });

    const { result } = renderHookWithProviders(() => useSimulateAllocate({ config }));

    await act(async () => {
      await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT, from: FROM });
    });

    expect(simulateContract.mock.calls[0]![0].account).toBe(FROM);
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateAllocate({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: SUB_ACCOUNT, amount: AMOUNT });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
