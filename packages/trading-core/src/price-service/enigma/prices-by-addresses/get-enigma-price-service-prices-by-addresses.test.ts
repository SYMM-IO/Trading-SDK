import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";

const getPricesBySymbolAddressesApiV1PricesGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-price-service")>();
  return {
    ...actual,
    getPricesBySymbolAddressesApiV1PricesGet,
  };
});

import { getEnigmaPriceServicePricesByAddresses } from "./get-enigma-price-service-prices-by-addresses";

const PRICE_SERVICE_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).priceService.url;
const config = createConfig({ getClient: () => ({}) as PublicClient });

describe("getEnigmaPriceServicePricesByAddresses", () => {
  beforeEach(() => {
    getPricesBySymbolAddressesApiV1PricesGet.mockReset();
  });

  it("fetches prices with the configured price-service base URL", async () => {
    const data = { "0xabc": { name: "TEST", markPrice: 1.23, time: 123 } };
    getPricesBySymbolAddressesApiV1PricesGet.mockResolvedValue({ data });

    await expect(getEnigmaPriceServicePricesByAddresses(config, { addresses: ["0xabc", "0xdef"] })).resolves.toEqual(
      data,
    );
    expect(getPricesBySymbolAddressesApiV1PricesGet).toHaveBeenCalledWith(
      { addresses: "0xabc,0xdef" },
      { baseURL: PRICE_SERVICE_URL },
    );
  });

  it("wraps request failures in a SymmError", async () => {
    getPricesBySymbolAddressesApiV1PricesGet.mockRejectedValue(new Error("Network error"));

    await expect(getEnigmaPriceServicePricesByAddresses(config, { addresses: ["0xabc"] })).rejects.toBeInstanceOf(
      SymmError,
    );
    await expect(getEnigmaPriceServicePricesByAddresses(config, { addresses: ["0xabc"] })).rejects.toThrow(
      "Failed to fetch Enigma price-service prices by addresses",
    );
  });
});
