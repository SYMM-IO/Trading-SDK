import { accountLayerAbi as coreAbi } from "@symmio/trading-core";
import { encodeFunctionData } from "viem";
import { expect, it } from "vitest";
import { accountLayerAbi } from "../index";

it("exposes the pinned AccountLayer ABI for exact timelock policy calls", () => {
  expect(accountLayerAbi).toBe(coreAbi);
  expect(
    encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "clearTimelocks",
      args: ["0x1111111111111111111111111111111111111111", ["0xe3b6de98"]],
    }).slice(0, 10),
  ).toBe("0x7e8f5407");
});
