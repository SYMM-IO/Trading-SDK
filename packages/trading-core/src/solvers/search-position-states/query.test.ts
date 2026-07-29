import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, searchPositionStatePositionStateStartSizePost: genFn };
});

import { searchPositionStatesQueryKey, searchPositionStatesQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const USER = "0x1111111111111111111111111111111111111111" as const;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("searchPositionStatesQueryOptions", () => {
  it("separates cache entries by solverId and by filters", () => {
    const base = { chainId: BASE, solverId: "rasa" as const, start: 0, size: 10 };
    expect(searchPositionStatesQueryKey(base)).not.toEqual(
      searchPositionStatesQueryKey({ ...base, solverId: "enigma" }),
    );
    expect(searchPositionStatesQueryKey(base)).not.toEqual(searchPositionStatesQueryKey({ ...base, quoteId: 7 }));
  });

  it("queryFn forwards paging and every filter to the fetch, not just the key", async () => {
    genFn.mockResolvedValue({ data: { count: 0, position_state: [] } });
    const spy = vi.spyOn(config, "getSolver");

    const options = searchPositionStatesQueryOptions(config, {
      chainId: BASE,
      solverId: "rasa",
      start: 0,
      size: 10,
      address: USER,
      quoteId: 7,
      createTimeGte: 100,
      modifyTimeGte: 200,
    });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith({ chainId: BASE, solverId: "rasa" });
    expect(genFn).toHaveBeenCalledWith(
      0,
      10,
      { address: USER, quote_id: 7, create_time_gte: 100, modify_time_gte: 200 },
      { baseURL: getDefaultSolver(BASE).url },
    );
  });
});
