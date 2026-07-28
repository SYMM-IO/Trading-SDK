import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getChainConfig, getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, getBalanceInfoGetBalanceInfoAddressMultiAccountAddressGet: genFn };
});

import { getSolverBalanceInfoQueryKey, getSolverBalanceInfoQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const USER = "0x1111111111111111111111111111111111111111" as const;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getSolverBalanceInfoQueryOptions", () => {
  it("separates cache entries by solverId and includes the required address", () => {
    const a = getSolverBalanceInfoQueryKey({ chainId: BASE, solverId: "rasa", address: USER });
    const b = getSolverBalanceInfoQueryKey({ chainId: BASE, solverId: "other", address: USER });
    expect(a).not.toEqual(b);
    expect(JSON.stringify(a)).toContain(USER);
  });

  it("queryFn forwards every parameter to the fetch, not just the key", async () => {
    genFn.mockResolvedValue({ data: [] });
    const spy = vi.spyOn(config, "getSolver");

    const options = getSolverBalanceInfoQueryOptions(config, { chainId: BASE, solverId: "rasa", address: USER });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith({ chainId: BASE, solverId: "rasa" });
    expect(genFn).toHaveBeenCalledWith(USER, getChainConfig(BASE).addresses.accountLayerAddress, {
      baseURL: getDefaultSolver(BASE).url,
    });
  });
});
