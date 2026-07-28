import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, getSymbolPriceRangePriceRangeSymbolGet: genFn };
});

import { getSolverPriceRangeQueryKey, getSolverPriceRangeQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getSolverPriceRangeQueryOptions", () => {
  it("separates cache entries by solverId and includes the required symbol", () => {
    const a = getSolverPriceRangeQueryKey({ chainId: BASE, solverId: "rasa", symbol: "BTCUSDT" });
    const b = getSolverPriceRangeQueryKey({ chainId: BASE, solverId: "other", symbol: "BTCUSDT" });
    expect(a).not.toEqual(b);
    expect(JSON.stringify(a)).toContain("BTCUSDT");
  });

  it("queryFn forwards the symbol to the fetch, not just the key", async () => {
    genFn.mockResolvedValue({ data: { min_price: "1", max_price: "2" } });
    const spy = vi.spyOn(config, "getSolver");

    const options = getSolverPriceRangeQueryOptions(config, { chainId: BASE, solverId: "rasa", symbol: "BTCUSDT" });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith({ chainId: BASE, solverId: "rasa" });
    expect(genFn).toHaveBeenCalledWith("BTCUSDT", { baseURL: getDefaultSolver(BASE).url });
  });
});
