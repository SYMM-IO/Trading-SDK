import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";

const getMarkets = vi.hoisted(() => vi.fn());

vi.mock("../../markets/get-markets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../markets/get-markets")>();
  return { ...actual, getMarkets };
});

import { resolveMarket } from "./resolve-market";

const { config } = mockConfig();

describe("resolveMarket", () => {
  beforeEach(() => {
    getMarkets.mockReset();
  });

  it("returns caller-supplied metadata without fetching when name and both precisions are provided", async () => {
    await expect(
      resolveMarket(config, { marketId: 1, marketName: "BTCUSDT", pricePrecision: 2, quantityPrecision: 3 }),
    ).resolves.toEqual({ name: "BTCUSDT", pricePrecision: 2, quantityPrecision: 3 });
    expect(getMarkets).not.toHaveBeenCalled();
  });

  it("treats a zero precision as provided and does not fetch", async () => {
    await expect(
      resolveMarket(config, { marketId: 1, marketName: "X", pricePrecision: 0, quantityPrecision: 0 }),
    ).resolves.toEqual({ name: "X", pricePrecision: 0, quantityPrecision: 0 });
    expect(getMarkets).not.toHaveBeenCalled();
  });

  it("fetches and extracts the matching record when metadata is omitted", async () => {
    getMarkets.mockResolvedValue([
      { symbol_id: 1, name: "BTCUSDT", price_precision: 2, quantity_precision: 3 },
      { symbol_id: 2, name: "ETHUSDT", price_precision: 4, quantity_precision: 5 },
    ]);

    await expect(resolveMarket(config, { marketId: 2 })).resolves.toEqual({
      name: "ETHUSDT",
      pricePrecision: 4,
      quantityPrecision: 5,
    });
    expect(getMarkets).toHaveBeenCalledWith(config, { chainId: undefined });
  });

  it("forwards the chainId override to getMarkets", async () => {
    getMarkets.mockResolvedValue([{ symbol_id: 1, name: "BTCUSDT", price_precision: 2, quantity_precision: 3 }]);

    await resolveMarket(config, { marketId: 1, chainId: 999 });
    expect(getMarkets).toHaveBeenCalledWith(config, { chainId: 999 });
  });

  it("prefers caller-supplied fields over the fetched record for the ones provided", async () => {
    getMarkets.mockResolvedValue([{ symbol_id: 1, name: "BTCUSDT", price_precision: 2, quantity_precision: 3 }]);

    await expect(resolveMarket(config, { marketId: 1, marketName: "CUSTOM", pricePrecision: 9 })).resolves.toEqual({
      name: "CUSTOM",
      pricePrecision: 9,
      quantityPrecision: 3,
    });
  });

  it("keeps a caller-supplied zero precision when it still has to fetch for the name", async () => {
    getMarkets.mockResolvedValue([{ symbol_id: 1, name: "BTCUSDT", price_precision: 2, quantity_precision: 3 }]);

    await expect(resolveMarket(config, { marketId: 1, pricePrecision: 0 })).resolves.toEqual({
      name: "BTCUSDT",
      pricePrecision: 0,
      quantityPrecision: 3,
    });
  });

  it("resolves a record whose precisions are zero (0 is valid, not incomplete)", async () => {
    getMarkets.mockResolvedValue([{ symbol_id: 1, name: "BTCUSDT", price_precision: 0, quantity_precision: 0 }]);

    await expect(resolveMarket(config, { marketId: 1 })).resolves.toEqual({
      name: "BTCUSDT",
      pricePrecision: 0,
      quantityPrecision: 0,
    });
  });

  it("fills a missing record field from the caller-supplied value instead of throwing", async () => {
    getMarkets.mockResolvedValue([{ symbol_id: 1, price_precision: 2, quantity_precision: 3 }]);

    await expect(resolveMarket(config, { marketId: 1, marketName: "FALLBACK" })).resolves.toEqual({
      name: "FALLBACK",
      pricePrecision: 2,
      quantityPrecision: 3,
    });
  });

  it("throws RESOLVE_MARKET_NOT_FOUND when no record matches the marketId", async () => {
    getMarkets.mockResolvedValue([{ symbol_id: 1, name: "BTCUSDT", price_precision: 2, quantity_precision: 3 }]);

    const error = await resolveMarket(config, { marketId: 99 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).kind).toBe("api");
    expect((error as SymmError).code).toBe("RESOLVE_MARKET_NOT_FOUND");
    expect((error as SymmError).message).toContain("99");
  });

  it("throws RESOLVE_MARKET_NOT_FOUND when the solver returns an empty list", async () => {
    getMarkets.mockResolvedValue([]);

    const error = await resolveMarket(config, { marketId: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).code).toBe("RESOLVE_MARKET_NOT_FOUND");
  });

  it("throws RESOLVE_MARKET_METADATA_INCOMPLETE when the matched record has no name", async () => {
    getMarkets.mockResolvedValue([{ symbol_id: 1, price_precision: 2, quantity_precision: 3 }]);

    const error = await resolveMarket(config, { marketId: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).kind).toBe("api");
    expect((error as SymmError).code).toBe("RESOLVE_MARKET_METADATA_INCOMPLETE");
    expect((error as SymmError).message).toContain("1");
  });

  it("throws RESOLVE_MARKET_METADATA_INCOMPLETE when the matched record is missing a precision", async () => {
    getMarkets.mockResolvedValue([{ symbol_id: 1, name: "BTCUSDT", price_precision: 2 }]);

    const error = await resolveMarket(config, { marketId: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).code).toBe("RESOLVE_MARKET_METADATA_INCOMPLETE");
  });
});
