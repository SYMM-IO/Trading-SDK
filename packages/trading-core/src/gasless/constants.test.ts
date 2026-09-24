import { getAbiItem, keccak256, slice, toFunctionSelector, toFunctionSignature, toHex, type AbiParameter } from "viem";
import { describe, expect, it } from "vitest";
import { gaslessLayerAbi } from "../symmio-contracts/abi/v0.8.6/gasless-layer";
import { gaslessWalletAbi } from "../symmio-contracts/abi/v0.8.6/gasless-wallet";
import { instantLayerAbi } from "../symmio-contracts/abi/v0.8.6/instant-layer";
import { GASLESS_WALLET_EXECUTE_SELECTOR, GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR } from "./constants";

/** An ABI parameter reduced to what encoding depends on: name, type, and nested components. */
interface EncodingShape {
  name?: string;
  type: string;
  components?: EncodingShape[];
}

/** Strip `internalType` (a Solidity source label that differs across contracts) recursively. */
function encodingShape(parameter: AbiParameter): EncodingShape {
  return {
    name: parameter.name,
    type: parameter.type,
    ...("components" in parameter ? { components: parameter.components.map(encodingShape) } : {}),
  };
}

describe("gasless constants", () => {
  it("pins GASLESS_WALLET_EXECUTE_SELECTOR to the full wallet ABI's execute((address,uint256,bytes)[])", () => {
    const execute = getAbiItem({ abi: gaslessWalletAbi, name: "execute" });

    expect(toFunctionSignature(execute)).toBe("execute((address,uint256,bytes)[])");
    expect(GASLESS_WALLET_EXECUTE_SELECTOR).toBe(toFunctionSelector(execute));
  });

  it("derives GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR from its documented preimage", () => {
    expect(GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR).toBe(slice(keccak256(toHex("GASLESSQ_WALLET_EXECUTION")), 0, 4));
  });

  it("relays exactly the SignedOperation struct the InstantLayer executes", () => {
    /**
     * The relay batch passes operations as objects, which viem encodes by
     * component name — so names must match the canonical InstantLayer struct,
     * not just types. `internalType` is ignored: the GaslessLayer labels the
     * struct `IInstantLayer.SignedOperation`, the InstantLayer `InstantLayer.SignedOperation`.
     */
    const relayed = getAbiItem({ abi: gaslessLayerAbi, name: "relayInstantBatch" }).inputs[0];
    const executed = getAbiItem({ abi: instantLayerAbi, name: "executeBatch" }).inputs[0];

    expect(relayed.type).toBe("tuple[]");
    expect(encodingShape(relayed).components).toEqual(encodingShape(executed).components);
  });
});
