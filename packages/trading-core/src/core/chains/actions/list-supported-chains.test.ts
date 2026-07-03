import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../supported-chains";
import { listSupportedChains } from "./list-supported-chains";

describe("listSupportedChains", () => {
  it("includes every built-in supported chain", () => {
    expect(listSupportedChains()).toContain(SymmioSupportedChainId.HYPER_EVM);
  });

  it("returns only numeric chain ids, not the enum's reverse-mapped keys", () => {
    expect(listSupportedChains().every((id) => typeof id === "number")).toBe(true);
  });

  it("matches the numeric members of SymmioSupportedChainId", () => {
    const expected = Object.values(SymmioSupportedChainId).filter((value) => typeof value === "number");
    expect(listSupportedChains()).toEqual(expected);
  });
});
