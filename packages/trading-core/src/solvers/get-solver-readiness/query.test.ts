import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, readyCheckReadyzGet: genFn };
});

import { getSolverReadinessQueryKey, getSolverReadinessQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getSolverReadinessQueryOptions", () => {
  it("separates cache entries by solverId", () => {
    expect(getSolverReadinessQueryKey({ chainId: BASE, solverId: "rasa" })).not.toEqual(
      getSolverReadinessQueryKey({ chainId: BASE, solverId: "other" }),
    );
  });

  it("queryFn forwards chain and solver to the fetch, not just the key", async () => {
    genFn.mockResolvedValue({ data: { isReady: true } });
    const spy = vi.spyOn(config, "getSolver");

    const options = getSolverReadinessQueryOptions(config, { chainId: BASE, solverId: "rasa" });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith({ chainId: BASE, solverId: "rasa" });
    expect(genFn).toHaveBeenCalledWith({ baseURL: getDefaultSolver(BASE).url });
  });
});
