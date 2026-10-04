import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return { ...actual, getInfo: genFn };
});

import { getSolverInfoQueryKey, getSolverInfoQueryOptions } from "./query";

const ARBITRUM = SymmioSupportedChainId.ARBITRUM;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

describe("getSolverInfoQueryOptions", () => {
  it("separates cache entries by solverId", () => {
    expect(getSolverInfoQueryKey({ chainId: ARBITRUM, solverId: "enigma" })).not.toEqual(
      getSolverInfoQueryKey({ chainId: ARBITRUM, solverId: "rasa" }),
    );
  });

  it("queryFn forwards chain and solver to the fetch, not just the key", async () => {
    genFn.mockResolvedValue({ data: { static_solver_fee_open: "0.5" } });
    const spy = vi.spyOn(config, "getSolver");

    const options = getSolverInfoQueryOptions(config, { chainId: ARBITRUM, solverId: "enigma" });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith({ chainId: ARBITRUM, solverId: "enigma" });
    expect(genFn).toHaveBeenCalledWith({ baseURL: getDefaultSolver(ARBITRUM).url });
  });
});
