import { getChainConfig, SymmioSupportedChainId } from "@theoldvarorg/core";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useSimulateAddMargin } from "./use-simulate-add-margin";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const VIRTUAL_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FROM: Address = "0x1111111111111111111111111111111111111111";
const AMOUNT = 50_000000000000000000n;

describe("useSimulateAddMargin", () => {
  it("is idle until mutate is called", () => {
    const { config, simulateContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSimulateAddMargin({ config }));

    expect(result.current.isIdle).toBe(true);
    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("simulates addMargin against the AccountLayer and returns the dry-run result", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateAddMargin({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT });
    });

    expect(res).toBeDefined();
    const call = simulateContract.mock.calls[0]![0];
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("addMargin");
    expect(call.args).toEqual([VIRTUAL_ACCOUNT, AMOUNT]);
  });

  it("uses an explicit `from` override when provided", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockResolvedValueOnce({ result: undefined, request: {} });

    const { result } = renderHookWithProviders(() => useSimulateAddMargin({ config }));

    await act(async () => {
      await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT, from: FROM });
    });

    expect(simulateContract.mock.calls[0]![0].account).toBe(FROM);
  });

  it("normalizes a revert into a SymmioRequestError", async () => {
    const { config, simulateContract } = createMockSymmioConfig();
    simulateContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() => useSimulateAddMargin({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
