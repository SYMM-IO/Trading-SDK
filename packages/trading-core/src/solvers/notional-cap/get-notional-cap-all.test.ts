import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ApiNotionalCapAllSymbolsResponse } from "../types/generated/enigma-solver";

const getNotionalCap = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getNotionalCap,
  };
});

import { getNotionalCapAll } from "./get-notional-cap-all";

const SOLVER_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.url;
const config = createConfig({ getClient: () => ({}) as PublicClient });

const SAMPLE_RESPONSE: { data: ApiNotionalCapAllSymbolsResponse } = {
  data: {
    count: 2,
    total_open_interest: 1500,
    total_used: 900,
    symbols: [
      {
        symbol_id: 132,
        symbol: "DOGEUSDT",
        available_to_long: 1000,
        available_to_short: 800,
        open_interest: 1200,
      },
      {
        symbol_id: 7,
        symbol: "PEPEUSDT",
        available_to_long: 50,
        available_to_short: 40,
        open_interest: 300,
      },
    ],
  },
};

describe("getNotionalCapAll", () => {
  beforeEach(() => {
    getNotionalCap.mockReset();
  });

  it("requests the config's solver base URL and splits aggregate totals from per-symbol rows", async () => {
    getNotionalCap.mockResolvedValue(SAMPLE_RESPONSE);

    const all = await getNotionalCapAll(config, {});

    expect(getNotionalCap).toHaveBeenCalledWith(undefined, expect.objectContaining({ baseURL: SOLVER_URL }));
    expect(all.count).toBe(2);
    expect(all.totalOpenInterest).toBe(1500);
    expect(all.totalUsed).toBe(900);
    expect(all.symbols).toHaveLength(2);
    expect(all.symbols[0]).toMatchObject({
      symbolId: 132,
      symbol: "DOGEUSDT",
      availableToLong: 1000,
      availableToShort: 800,
      openInterest: 1200,
      error: null,
    });
  });

  it("coerces numeric-string totals via toFiniteNumber", async () => {
    getNotionalCap.mockResolvedValue({
      data: { count: "3", total_open_interest: "2500", total_used: "1200", symbols: [] },
    });

    const all = await getNotionalCapAll(config, {});

    expect(all).toMatchObject({ count: 3, totalOpenInterest: 2500, totalUsed: 1200, symbols: [] });
  });

  it("returns zeroed totals and no symbols when the solver omits them", async () => {
    getNotionalCap.mockResolvedValue({ data: {} });

    expect(await getNotionalCapAll(config, {})).toEqual({
      count: 0,
      totalOpenInterest: 0,
      totalUsed: 0,
      symbols: [],
    });
  });

  it("falls back to an empty symbols array when `symbols` is not an array", async () => {
    getNotionalCap.mockResolvedValue({ data: { count: 0, symbols: "unexpected" } });

    expect((await getNotionalCapAll(config, {})).symbols).toEqual([]);
  });

  it("wraps a generic request failure in a SymmError", async () => {
    getNotionalCap.mockRejectedValue(new Error("Network error"));

    await expect(getNotionalCapAll(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(getNotionalCapAll(config, {})).rejects.toThrow("Failed to fetch notional caps");
  });

  it("wraps an axios transport error in a SymmApiError", async () => {
    getNotionalCap.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      config: { url: "/notional_cap" },
      response: { status: 503, statusText: "Service Unavailable" },
    });

    const error = await getNotionalCapAll(config, {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmApiError);
    expect((error as SymmApiError).code).toBe("FETCH_NOTIONAL_CAP_ALL_FAILED");
  });
});
