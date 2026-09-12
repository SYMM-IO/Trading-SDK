import { getAbiItem, keccak256, slice, toFunctionSelector, toFunctionSignature, toHex } from "viem";
import { describe, expect, it } from "vitest";
import { instantLayerAbi } from "../../symmio-contracts/abi/v0.8.6/instant-layer";
import {
  GASLESS_WALLET_EXECUTE_SELECTOR,
  GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR,
  gaslessLayerAbi,
  gaslessWalletAbi,
} from "./gasless-layer-abi";

describe("gasless-layer-abi", () => {
  it("pins GASLESS_WALLET_EXECUTE_SELECTOR to the wallet's execute((address,uint256,bytes)[])", () => {
    const execute = getAbiItem({ abi: gaslessWalletAbi, name: "execute" });

    expect(toFunctionSignature(execute)).toBe("execute((address,uint256,bytes)[])");
    expect(GASLESS_WALLET_EXECUTE_SELECTOR).toBe(toFunctionSelector(execute));
  });

  it("derives GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR from its documented preimage", () => {
    expect(GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR).toBe(slice(keccak256(toHex("GASLESSQ_WALLET_EXECUTION")), 0, 4));
  });

  it("quotes fees over exactly the SignedOperation struct the InstantLayer executes", () => {
    /**
     * The fee quote passes operations as objects, which viem encodes by component
     * name — so names must match the canonical InstantLayer struct, not just types.
     */
    const quoted = getAbiItem({ abi: gaslessLayerAbi, name: "getAccountOperationalFee" }).inputs[1];
    const executed = getAbiItem({ abi: instantLayerAbi, name: "executeBatch" }).inputs[0];

    expect(quoted).toEqual(executed);
  });
});
