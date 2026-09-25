import { GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR, type GaslessWalletCall } from "@symmio/trading-core";
import { renderHook } from "@testing-library/react";
import { erc20Abi, toFunctionSelector, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { useGaslessWalletExecuteSelectors } from "./use-gasless-wallet-execute-selectors";

const TOKEN = "0x0000000000000000000000000000000000000001" as Address;
const RECIPIENT = "0x0000000000000000000000000000000000000002" as Address;
const TRANSFER = toFunctionSelector("transfer(address,uint256)");

function transferCall(): GaslessWalletCall {
  return { target: TOKEN, abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] };
}

describe("useGaslessWalletExecuteSelectors", () => {
  it("returns the sentinel followed by every inner call selector", () => {
    const { result } = renderHook(() => useGaslessWalletExecuteSelectors({ calls: [transferCall()] }));

    expect(result.current).toEqual([GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR, TRANSFER]);
  });

  it("returns an empty set while no batch can be described", () => {
    const { result } = renderHook(() => useGaslessWalletExecuteSelectors({ calls: undefined }));

    expect(result.current).toEqual([]);
  });

  it("keeps its reference while a rebuilt batch yields the same selectors", () => {
    /** The card rebuilds `calls` on every keystroke, so a fresh array must not churn the result. */
    const { result, rerender } = renderHook(() => useGaslessWalletExecuteSelectors({ calls: [transferCall()] }));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it("returns a new set once the batch's selectors change", () => {
    const { result, rerender } = renderHook(
      ({ calls }: { calls: readonly GaslessWalletCall[] }) => useGaslessWalletExecuteSelectors({ calls }),
      { initialProps: { calls: [transferCall()] as readonly GaslessWalletCall[] } },
    );
    const first = result.current;

    rerender({ calls: [{ target: TOKEN, data: "0xdeadbeef" }] as readonly GaslessWalletCall[] });

    expect(result.current).not.toBe(first);
    expect(result.current).toEqual([GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR, "0xdeadbeef"]);
  });
});
