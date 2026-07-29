import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, searchNotificationNotificationsStartSizePost: genFn };
});

import { searchSolverNotificationsQueryKey, searchSolverNotificationsQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const USER = "0x1111111111111111111111111111111111111111" as const;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("searchSolverNotificationsQueryOptions", () => {
  it("separates cache entries by solverId and by filters", () => {
    const base = { chainId: BASE, solverId: "rasa" as const, start: 0, size: 5 };
    expect(searchSolverNotificationsQueryKey(base)).not.toEqual(
      searchSolverNotificationsQueryKey({ ...base, solverId: "enigma" }),
    );
    expect(searchSolverNotificationsQueryKey(base)).not.toEqual(
      searchSolverNotificationsQueryKey({ ...base, timestampGte: 5 }),
    );
  });

  it("queryFn forwards paging and every filter to the fetch, not just the key", async () => {
    genFn.mockResolvedValue({ data: { count: 0, notification_data: [] } });
    const spy = vi.spyOn(config, "getSolver");

    const options = searchSolverNotificationsQueryOptions(config, {
      chainId: BASE,
      solverId: "rasa",
      start: 0,
      size: 5,
      counterpartyAddress: USER,
      quoteId: 9,
      timestampGte: 300,
    });
    await (options.queryFn as () => Promise<unknown>)();

    expect(spy).toHaveBeenCalledWith({ chainId: BASE, solverId: "rasa" });
    expect(genFn).toHaveBeenCalledWith(
      0,
      5,
      { counterparty_address: USER, quote_id: 9, timestamp_gte: 300 },
      { baseURL: getDefaultSolver(BASE).url },
    );
  });
});
