import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, getOpenInterestOpenInterestGet: genFn };
});

import { getSolverOpenInterestQueryKey, getSolverOpenInterestQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getSolverOpenInterestQueryOptions", () => {
  it("separates cache entries by solverId", () => {
    const a = getSolverOpenInterestQueryKey({ chainId: BASE, solverId: "rasa" });
    const b = getSolverOpenInterestQueryKey({ chainId: BASE, solverId: "enigma" });
    expect(a).not.toEqual(b);
  });

  it("queryFn forwards chain and solver to the fetch, not just the key", async () => {
    genFn.mockResolvedValue({ data: { total_cap: "1", used: "0" } });
    const spy = vi.spyOn(config, "getSolver");

    const options = getSolverOpenInterestQueryOptions(config, { chainId: BASE, solverId: "rasa" });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith({ chainId: BASE, solverId: "rasa" });
    expect(genFn).toHaveBeenCalledWith({ baseURL: getDefaultSolver(BASE).url });
  });
});
