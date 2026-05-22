import { hyperEvm } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmError } from "../errors";
import { getAccountLayerAddress, listAccountLayerChains } from "./account-layer-addresses";

describe("getAccountLayerAddress", () => {
  it("returns the HyperEVM AccountLayer address for the HyperEVM chain", () => {
    expect(getAccountLayerAddress(hyperEvm.id)).toBe("0x46493c376758Da47823D7E3Ae5d417eA6546eEB3");
  });

  it("throws SymmError for an unregistered chain", () => {
    expect(() => getAccountLayerAddress(123456789)).toThrow(SymmError);
  });
});

describe("listAccountLayerChains", () => {
  it("lists HyperEVM as the only built-in chain in this slice", () => {
    expect(listAccountLayerChains()).toEqual([hyperEvm.id]);
  });
});
