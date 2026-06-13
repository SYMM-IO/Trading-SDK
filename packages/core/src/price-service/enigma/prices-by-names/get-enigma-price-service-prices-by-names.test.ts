import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";

const getSymbolPricesBatchApiV1PricesNamesGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-price-service")>();
  return {
    ...actual,
    getSymbolPricesBatchApiV1PricesNamesGet,
  };
});

import { getEnigmaPriceServicePricesByNames } from "./get-enigma-price-service-prices-by-names";

const PRICE_SERVICE_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).priceService.url;
const config = createConfig({ getClient: () => ({}) as PublicClient });

describe("getEnigmaPriceServicePricesByNames", () => {
  beforeEach(() => {
    getSymbolPricesBatchApiV1PricesNamesGet.mockReset();
  });

  it("fetches prices with the configured price-service base URL", async () => {
    const data = {
      BTCUSDT: { name: "BTCUSDT", markPrice: 50000, time: 1 },
      ETHUSDT: { name: "ETHUSDT", markPrice: 3000, time: 2 },
    };
    getSymbolPricesBatchApiV1PricesNamesGet.mockResolvedValue({ data });

    await expect(getEnigmaPriceServicePricesByNames(config, { names: ["BTCUSDT", "ETHUSDT"] })).resolves.toEqual(data);
    expect(getSymbolPricesBatchApiV1PricesNamesGet).toHaveBeenCalledWith("BTCUSDT,ETHUSDT", {
      baseURL: PRICE_SERVICE_URL,
    });
  });

  it("wraps request failures in a SymmError", async () => {
    getSymbolPricesBatchApiV1PricesNamesGet.mockRejectedValue(new Error("Network error"));

    await expect(getEnigmaPriceServicePricesByNames(config, { names: ["BTCUSDT"] })).rejects.toBeInstanceOf(SymmError);
    await expect(getEnigmaPriceServicePricesByNames(config, { names: ["BTCUSDT"] })).rejects.toThrow(
      "Failed to fetch Enigma price-service prices by names",
    );
  });
});
