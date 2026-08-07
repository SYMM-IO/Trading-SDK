import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";

const getEnigmaPriceServicePricesByNames = vi.hoisted(() => vi.fn());

vi.mock(
  "../../../price-service/enigma/prices-by-names/get-enigma-price-service-prices-by-names",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../price-service/enigma/prices-by-names/get-enigma-price-service-prices-by-names")
      >();
    return { ...actual, getEnigmaPriceServicePricesByNames };
  },
);

import { resolveMarkPrice } from "./resolve-mark-price";

const { config } = mockConfig();

describe("resolveMarkPrice", () => {
  beforeEach(() => {
    getEnigmaPriceServicePricesByNames.mockReset();
  });

  it("returns the caller-supplied markPrice without calling the price service", async () => {
    await expect(resolveMarkPrice(config, { marketName: "BTCUSDT", markPrice: "64000.5" })).resolves.toBe("64000.5");
    expect(getEnigmaPriceServicePricesByNames).not.toHaveBeenCalled();
  });

  it("returns an empty caller-supplied markPrice verbatim (only undefined triggers a fetch)", async () => {
    await expect(resolveMarkPrice(config, { marketName: "BTCUSDT", markPrice: "" })).resolves.toBe("");
    expect(getEnigmaPriceServicePricesByNames).not.toHaveBeenCalled();
  });

  it("fetches from the Enigma price service when markPrice is omitted", async () => {
    getEnigmaPriceServicePricesByNames.mockResolvedValue({
      BTCUSDT: { name: "BTCUSDT", markPrice: 64000.5, time: 1 },
    });

    await expect(resolveMarkPrice(config, { marketName: "BTCUSDT" })).resolves.toBe("64000.5");
    expect(getEnigmaPriceServicePricesByNames).toHaveBeenCalledWith(config, {
      chainId: undefined,
      names: ["BTCUSDT"],
    });
  });

  it("forwards the chainId override to the price service", async () => {
    getEnigmaPriceServicePricesByNames.mockResolvedValue({
      ETHUSDT: { name: "ETHUSDT", markPrice: 3200, time: 1 },
    });

    await resolveMarkPrice(config, { chainId: 999, marketName: "ETHUSDT" });
    expect(getEnigmaPriceServicePricesByNames).toHaveBeenCalledWith(config, {
      chainId: 999,
      names: ["ETHUSDT"],
    });
  });

  it('returns "0" for a zero mark price rather than treating the entry as missing', async () => {
    getEnigmaPriceServicePricesByNames.mockResolvedValue({
      BTCUSDT: { name: "BTCUSDT", markPrice: 0, time: 1 },
    });

    await expect(resolveMarkPrice(config, { marketName: "BTCUSDT" })).resolves.toBe("0");
  });

  it("throws RESOLVE_MARK_PRICE_NOT_FOUND when the response omits the requested market", async () => {
    getEnigmaPriceServicePricesByNames.mockResolvedValue({});

    const error = await resolveMarkPrice(config, { marketName: "BTCUSDT" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).kind).toBe("api");
    expect((error as SymmError).code).toBe("RESOLVE_MARK_PRICE_NOT_FOUND");
    expect((error as SymmError).message).toContain("BTCUSDT");
  });

  it("throws RESOLVE_MARK_PRICE_NOT_FOUND when the response carries only other markets", async () => {
    getEnigmaPriceServicePricesByNames.mockResolvedValue({
      ETHUSDT: { name: "ETHUSDT", markPrice: 3200, time: 1 },
    });

    const error = await resolveMarkPrice(config, { marketName: "BTCUSDT" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).code).toBe("RESOLVE_MARK_PRICE_NOT_FOUND");
  });
});
