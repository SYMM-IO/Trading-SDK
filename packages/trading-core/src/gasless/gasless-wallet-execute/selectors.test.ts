import { encodeFunctionData, erc20Abi, slice } from "viem";
import { describe, expect, it } from "vitest";
import { GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR } from "../gateway/gasless-layer-abi";
import { getGaslessWalletExecuteSelectors } from "./selectors";

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const ROUTER = "0x9999999999999999999999999999999999999999" as const;

describe("getGaslessWalletExecuteSelectors", () => {
  it("leads with the sentinel and adds every inner selector", () => {
    const transfer = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [ROUTER, 1n] });

    const selectors = getGaslessWalletExecuteSelectors([
      { target: USDC, abi: erc20Abi, functionName: "approve", args: [ROUTER, 1n] },
      { target: USDC, data: transfer },
    ]);

    expect(selectors[0]).toBe(GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR);
    expect(selectors).toContain(slice(transfer, 0, 4));
    expect(selectors).toHaveLength(3);
  });

  it("derives an ABI call's selector identically to raw calldata", () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ROUTER, 5n] });

    expect(
      getGaslessWalletExecuteSelectors([{ target: USDC, abi: erc20Abi, functionName: "approve", args: [ROUTER, 5n] }]),
    ).toEqual(getGaslessWalletExecuteSelectors([{ target: USDC, data }]));
  });

  it("de-duplicates repeats — grantDelegation rejects a duplicate-bearing array", () => {
    const selectors = getGaslessWalletExecuteSelectors([
      { target: USDC, abi: erc20Abi, functionName: "approve", args: [ROUTER, 1n] },
      { target: ROUTER, abi: erc20Abi, functionName: "approve", args: [USDC, 2n] },
    ]);

    expect(selectors).toHaveLength(2);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it("reports calldata shorter than a selector as the contract's own zero selector", () => {
    expect(getGaslessWalletExecuteSelectors([{ target: USDC, data: "0x" }])).toEqual([
      GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR,
      "0x00000000",
    ]);
  });
});
