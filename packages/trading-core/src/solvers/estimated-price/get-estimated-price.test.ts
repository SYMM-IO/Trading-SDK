import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { PositionType } from "../../symmio-contracts/symmio/types";

const estimatedPriceRequest = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return { ...actual, getEstimatedPrice: estimatedPriceRequest };
});

import { getEstimatedPrice } from "./get-estimated-price";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const OPEN_LONG = { symbolId: 1, quantity: "1", positionType: PositionType.LONG, entry: "open" as const, price: "1" };

describe("getEstimatedPrice", () => {
  beforeEach(() => estimatedPriceRequest.mockReset());

  it("sends symbol/quantity/side/entry/price to the solver and returns the estimated price", async () => {
    estimatedPriceRequest.mockResolvedValue({ data: { price: "0.0925" } });

    const result = await getEstimatedPrice(config, {
      symbolId: 1,
      quantity: "1000",
      positionType: PositionType.LONG,
      entry: "open",
      price: "0.09",
    });

    expect(estimatedPriceRequest).toHaveBeenCalledWith(
      { symbol_id: 1, quantity: "1000", position_type: "long", entry: "open", price: "0.09" },
      expect.objectContaining({ baseURL: SOLVER_URL }),
    );
    expect(result).toEqual({ estimatedPrice: "0.0925" });
  });

  it("encodes short + close on the wire", async () => {
    estimatedPriceRequest.mockResolvedValue({ data: { price: "1" } });
    await getEstimatedPrice(config, {
      symbolId: 2,
      quantity: "5",
      positionType: PositionType.SHORT,
      entry: "close",
      price: "1",
    });
    expect(estimatedPriceRequest).toHaveBeenCalledWith(
      expect.objectContaining({ position_type: "short", entry: "close" }),
      expect.anything(),
    );
  });

  it("defaults a missing price to '0'", async () => {
    estimatedPriceRequest.mockResolvedValue({ data: {} });
    expect(await getEstimatedPrice(config, OPEN_LONG)).toEqual({ estimatedPrice: "0" });
  });

  it("throws a SymmError for an unsupported chain", async () => {
    await expect(getEstimatedPrice(config, { ...OPEN_LONG, chainId: 1 })).rejects.toBeInstanceOf(SymmError);
  });
});
