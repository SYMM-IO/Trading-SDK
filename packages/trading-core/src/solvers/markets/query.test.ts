import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const getContractSymbols = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return { ...actual, getContractSymbols };
});

import { getMarketsQueryKey, getMarketsQueryOptions } from "./query";

const HYPEREVM = SymmioSupportedChainId.HYPER_EVM;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { [HYPEREVM]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getMarketsQueryOptions", () => {
  it("separates cache entries by solverId", () => {
    const a = getMarketsQueryKey({ chainId: HYPEREVM, solverId: "enigma" });
    const b = getMarketsQueryKey({ chainId: HYPEREVM, solverId: "rasa" });
    expect(a).not.toEqual(b);
  });

  it("queryFn forwards solverId to the fetch, not just the key", async () => {
    getContractSymbols.mockResolvedValue({ data: { symbols: [] } });
    const spy = vi.spyOn(config, "getSolver");

    const options = getMarketsQueryOptions(config, { chainId: HYPEREVM, solverId: "enigma" });
    await (options.queryFn as () => Promise<unknown>)();

    // If the queryFn dropped solverId, this would be called with `undefined` and
    // every solver would share the default solver's cached data.
    expect(spy).toHaveBeenCalledWith({ chainId: HYPEREVM, solverId: "enigma" });
  });
});
