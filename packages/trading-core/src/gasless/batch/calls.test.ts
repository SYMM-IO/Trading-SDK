import { encodeFunctionData, erc20Abi, toFunctionSelector, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { accountLayerAbi } from "../../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR } from "../constants";
import { GASLESS_RELAYABLE_WRITES } from "../relayable-writes";
import { gaslessBatchCallData, getGaslessBatchSelectors } from "./calls";

const USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const RECIPIENT: Address = "0x7777777777777777777777777777777777777777";
const VIRTUAL_ACCOUNT: Address = "0x4444444444444444444444444444444444444444";

/** The selector of a relayable write, taken from the canonical SDK map (never hardcoded). */
function relayableSelector(operationType: string): Hex {
  for (const [selector, write] of GASLESS_RELAYABLE_WRITES) {
    if (write.operationType === operationType) return selector;
  }
  throw new Error(`no relayable write is labelled "${operationType}"`);
}

describe("gaslessBatchCallData", () => {
  it("encodes a named relayable write without an ABI exactly as the SDK's own ABI does", () => {
    expect(gaslessBatchCallData({ functionName: "allocate", args: [5n] })).toBe(
      encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [5n] }),
    );
    expect(gaslessBatchCallData({ functionName: "addMargin", args: [VIRTUAL_ACCOUNT, 7n] })).toBe(
      encodeFunctionData({ abi: accountLayerAbi, functionName: "addMargin", args: [VIRTUAL_ACCOUNT, 7n] }),
    );
  });

  it("encodes against the caller's ABI when one is given, and passes raw calldata through", () => {
    const expected = encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [5n] });
    expect(gaslessBatchCallData({ abi: symmioAbi, functionName: "allocate", args: [5n] })).toBe(expected);
    expect(gaslessBatchCallData({ data: expected })).toBe(expected);
  });

  it("refuses a name that is not a relayable write", () => {
    /** `approveOperationalFee` exists on the diamond, but only its multiplier form is relayable. */
    expect(() => gaslessBatchCallData({ functionName: "approveOperationalFee", args: [[], []] })).toThrow(
      expect.objectContaining({ code: "GASLESS_NOT_RELAYABLE" }),
    );
    expect(() => gaslessBatchCallData({ functionName: "transfer", args: [RECIPIENT, 1n] })).toThrow(
      expect.objectContaining({ code: "GASLESS_NOT_RELAYABLE" }),
    );
  });
});

describe("getGaslessBatchSelectors", () => {
  it("lists each write's selector, then the wallet sentinel and inner selectors, de-duplicated and lowercased", () => {
    const allocateData = encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [9n] });
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] });

    const selectors = getGaslessBatchSelectors([
      { functionName: "allocate", args: [5n] },
      { data: allocateData.toUpperCase().replace("0X", "0x") as Hex },
      {
        walletId: 2n,
        walletCalls: [
          { target: USDC, abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] },
          { target: USDC, data: transferData },
        ],
      },
      { walletCalls: [{ target: USDC, abi: erc20Abi, functionName: "approve", args: [RECIPIENT, 1n] }] },
    ]);

    expect(selectors).toEqual([
      relayableSelector("allocate"),
      GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR,
      toFunctionSelector("transfer(address,uint256)"),
      toFunctionSelector("approve(address,uint256)"),
    ]);
  });
});
