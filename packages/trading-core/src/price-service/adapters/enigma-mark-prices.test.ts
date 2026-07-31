import { beforeEach, describe, expect, it, vi } from "vitest";

const getSymbolPricesBatchApiV1PricesNamesGet = vi.hoisted(() => vi.fn());
const getPricesApiV1PriceGet = vi.hoisted(() => vi.fn());

vi.mock("../enigma/types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../enigma/types/generated/enigma-price-service")>();
  return { ...actual, getSymbolPricesBatchApiV1PricesNamesGet, getPricesApiV1PriceGet };
});

import { fetchEnigmaMarkPrices, toEnigmaMarkPriceTick } from "./enigma-mark-prices";

const BASE_URL = "https://lowcap-price.enigma.bz";

describe("toEnigmaMarkPriceTick", () => {
  /**
   * The regression this locks down. `resolveMarkPrice` has always looked its
   * result up by the response's record KEY, while `PriceData` carries its own
   * `name`. Lowcap markets are exactly where the two diverge — a `"::"`-suffixed
   * key against a differently-spelled `name`. Mapping from `value.name` would
   * silently break every lowcap instant-open.
   */
  it("takes `name` from the record key, not from PriceData.name", () => {
    const tick = toEnigmaMarkPriceTick("TIBBIR::A4..00_SFLOW", {
      name: "TIBBIR",
      markPrice: 0.10691489650882736,
      time: 1785426740745,
    });

    expect(tick.name).toBe("TIBBIR::A4..00_SFLOW");
  });

  it("stringifies markPrice without reformatting it", () => {
    const tick = toEnigmaMarkPriceTick("BTCUSDT", { name: "BTCUSDT", markPrice: 0.10691489650882736, time: 1 });

    expect(tick.markPrice).toBe(String(0.10691489650882736));
  });

  it("stamps the enigma provider discriminant", () => {
    const tick = toEnigmaMarkPriceTick("BTCUSDT", { name: "BTCUSDT", markPrice: 1, time: 1 });

    expect(tick.provider).toBe("enigma");
  });
});

describe("fetchEnigmaMarkPrices", () => {
  beforeEach(() => {
    getSymbolPricesBatchApiV1PricesNamesGet.mockReset();
    getPricesApiV1PriceGet.mockReset();
  });

  /**
   * Byte-identical to the wire call the shipped `getEnigmaPriceServicePricesByNames`
   * makes — the proof that routing through the facade does not change the Enigma path.
   */
  it("makes the same batch-by-names call the shipped action makes", async () => {
    getSymbolPricesBatchApiV1PricesNamesGet.mockResolvedValue({ data: {} });

    await fetchEnigmaMarkPrices(BASE_URL, ["BTCUSDT", "ETHUSDT"]);

    expect(getSymbolPricesBatchApiV1PricesNamesGet).toHaveBeenCalledWith("BTCUSDT,ETHUSDT", { baseURL: BASE_URL });
  });

  it("returns ticks keyed by the caller's requested names", async () => {
    getSymbolPricesBatchApiV1PricesNamesGet.mockResolvedValue({
      data: { BTCUSDT: { name: "BTC", markPrice: 64790.2, time: 7 } },
    });

    const ticks = await fetchEnigmaMarkPrices(BASE_URL, ["BTCUSDT"]);

    expect(ticks).toEqual([{ provider: "enigma", name: "BTCUSDT", markPrice: "64790.2", time: 7 }]);
  });

  it("omits names the service does not return rather than failing the batch", async () => {
    getSymbolPricesBatchApiV1PricesNamesGet.mockResolvedValue({
      data: { BTCUSDT: { name: "BTCUSDT", markPrice: 1, time: 1 } },
    });

    const ticks = await fetchEnigmaMarkPrices(BASE_URL, ["BTCUSDT", "NOPEUSDT"]);

    expect(ticks.map((t) => t.name)).toEqual(["BTCUSDT"]);
  });

  it("short-circuits without a request when every name is blank", async () => {
    const ticks = await fetchEnigmaMarkPrices(BASE_URL, ["  "]);

    expect(ticks).toEqual([]);
    expect(getSymbolPricesBatchApiV1PricesNamesGet).not.toHaveBeenCalled();
  });

  it("reads the all-prices array when no names are supplied", async () => {
    getPricesApiV1PriceGet.mockResolvedValue({
      data: [{ name: "TIBBIR::A4..00_SFLOW", markPrice: 0.5, time: 3 }],
    });

    const ticks = await fetchEnigmaMarkPrices(BASE_URL);

    expect(getPricesApiV1PriceGet).toHaveBeenCalledWith({ baseURL: BASE_URL });
    expect(ticks).toEqual([{ provider: "enigma", name: "TIBBIR::A4..00_SFLOW", markPrice: "0.5", time: 3 }]);
  });
});
