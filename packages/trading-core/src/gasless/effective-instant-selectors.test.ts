import { encodeFunctionData, toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { getEffectiveInstantSelectors } from "./effective-instant-selectors";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;

describe("getEffectiveInstantSelectors", () => {
  it("unwraps every nested timelock wrapper to the delegated entry point", () => {
    const call = encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "_call",
      args: [ACCOUNT, ["0x12345678"]],
    });
    const once = encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "executeTimelockOp",
      args: [[], call],
    });
    const twice = encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "executeTimelockOp",
      args: [[], once],
    });
    expect(getEffectiveInstantSelectors(twice)).toEqual([
      toFunctionSelector(accountLayerAbi.find((item) => item.type === "function" && item.name === "_call")!),
    ]);
  });
});
