import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ApiNotionalCapBySymbolResponse } from "../types/generated/enigma-solver";

const getNotionalCapSymbolId = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getNotionalCapSymbolId,
  };
});

import { getNotionalCapBySymbolId } from "./get-notional-cap-by-symbol-id";

const SOLVER_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const SAMPLE_RESPONSE: { data: ApiNotionalCapBySymbolResponse } = {
  data: {
    symbol_id: 132,
    symbol: "DOGEUSDT",
    available_to_long: 1000,
    available_to_short: 800,
    open_interest: 1200,
    price: 0.12,
  },
};

describe("getNotionalCapBySymbolId", () => {
  beforeEach(() => {
    getNotionalCapSymbolId.mockReset();
  });

  it("requests the symbol at the config's solver base URL and decodes the response", async () => {
    getNotionalCapSymbolId.mockResolvedValue(SAMPLE_RESPONSE);

    const cap = await getNotionalCapBySymbolId(config, { symbolId: 132 });

    expect(getNotionalCapSymbolId).toHaveBeenCalledWith(132, expect.objectContaining({ baseURL: SOLVER_URL }));
    expect(cap).toMatchObject({
      symbolId: 132,
      symbol: "DOGEUSDT",
      availableToLong: 1000,
      availableToShort: 800,
      openInterest: 1200,
      price: 0.12,
      error: null,
    });
  });

  it("surfaces a solver-reported error string on the result instead of throwing", async () => {
    getNotionalCapSymbolId.mockResolvedValue({ data: { symbol_id: 132, error: "market paused" } });

    const cap = await getNotionalCapBySymbolId(config, { symbolId: 132 });

    expect(cap.error).toBe("market paused");
  });

  it("wraps a generic request failure in a SymmError", async () => {
    getNotionalCapSymbolId.mockRejectedValue(new Error("Network error"));

    await expect(getNotionalCapBySymbolId(config, { symbolId: 132 })).rejects.toBeInstanceOf(SymmError);
    await expect(getNotionalCapBySymbolId(config, { symbolId: 132 })).rejects.toThrow("Failed to fetch notional cap");
  });

  it("wraps an axios transport error in a SymmApiError", async () => {
    getNotionalCapSymbolId.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      config: { url: "/notional_cap/132" },
      response: { status: 404, statusText: "Not Found" },
    });

    const error = await getNotionalCapBySymbolId(config, { symbolId: 132 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmApiError);
    expect((error as SymmApiError).code).toBe("FETCH_NOTIONAL_CAP_FAILED");
  });
});
