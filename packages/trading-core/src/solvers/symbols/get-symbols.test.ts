import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiSymbolsResponse } from "../types/generated/enigma-solver";

const getSymbols = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getSymbols,
  };
});

import { getSymbols as getSymbolsAction } from "./get-symbols";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.ARBITRUM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

const SAMPLE_RESPONSE: { data: ApiSymbolsResponse } = {
  data: {
    count: 1,
    symbols: [
      {
        symbol_id: 1,
        name: "BTCUSDT",
        symbol: "BTC",
        asset: "BTC",
        is_valid: true,
        max_leverage: "100",
        state_long: 3,
        state_short: 3,
      },
    ],
  },
};

describe("getSymbols", () => {
  beforeEach(() => {
    getSymbols.mockReset();
  });

  it("requests the config's solver base URL and normalizes a symbols row", async () => {
    getSymbols.mockResolvedValue(SAMPLE_RESPONSE);

    const symbols = await getSymbolsAction(config, {});

    expect(getSymbols).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ baseURL: SOLVER_URL }));
    expect(symbols).toEqual([
      expect.objectContaining({
        symbolId: 1,
        name: "BTCUSDT",
        symbol: "BTC",
        asset: "BTC",
        isValid: true,
        maxLeverage: 100,
        stateLong: 3,
        stateShort: 3,
      }),
    ]);
  });

  it("maps the time-decaying close-fee fields from the wire", async () => {
    getSymbols.mockResolvedValue({
      data: {
        symbols: [
          {
            symbol_id: 1,
            name: "BTCUSDT",
            symbol: "BTC",
            hedger_fee_close: "0.0006",
            hedger_fee_close_early_rate: "0.0024",
            hedger_fee_close_early_threshold: "30",
            hedger_fee_close_standard_threshold: "180",
          },
        ],
      },
    });

    const symbols = await getSymbolsAction(config, {});

    expect(symbols[0]).toMatchObject({
      hedgerFeeClose: "0.0006",
      hedgerFeeCloseEarlyRate: "0.0024",
      hedgerFeeCloseEarlyThreshold: 30,
      hedgerFeeCloseStandardThreshold: 180,
    });
  });

  it("collapses the early rate to the standard rate when the early fields are absent", async () => {
    getSymbols.mockResolvedValue(SAMPLE_RESPONSE);

    const symbols = await getSymbolsAction(config, {});

    expect(symbols[0]).toMatchObject({
      hedgerFeeClose: "0",
      hedgerFeeCloseEarlyRate: "0",
      hedgerFeeCloseEarlyThreshold: 0,
      hedgerFeeCloseStandardThreshold: 0,
    });
  });

  it("maps camelCase filters onto the solver's snake_case query params", async () => {
    getSymbols.mockResolvedValue({ data: { symbols: [] } });

    await getSymbolsAction(config, { symbolId: 1, isValid: "any", stateLong: "enabled", tokenAddress: "0xabc" });

    expect(getSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol_id: 1,
        is_valid: "any",
        state_long: "enabled",
        token_address: "0xabc",
      }),
      expect.objectContaining({ baseURL: SOLVER_URL }),
    );
  });

  it("returns an empty array when the solver reports no symbols", async () => {
    getSymbols.mockResolvedValue({ data: {} });
    expect(await getSymbolsAction(config, {})).toEqual([]);
  });

  it("wraps request failures in a SymmError", async () => {
    getSymbols.mockRejectedValue(new Error("Network error"));
    await expect(getSymbolsAction(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(getSymbolsAction(config, {})).rejects.toThrow("Failed to fetch symbols");
  });

  it("throws UNSUPPORTED_BY_SOLVER when the resolved solver is not enigma", async () => {
    await expect(getSymbolsAction(config, { chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      code: "UNSUPPORTED_BY_SOLVER",
    });
    expect(getSymbols).not.toHaveBeenCalled();
  });
});
