import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchBinancePremiumIndexAll = vi.hoisted(() => vi.fn());
const fetchBinancePremiumIndexOne = vi.hoisted(() => vi.fn());

vi.mock("../binance/client", () => ({ fetchBinancePremiumIndexAll, fetchBinancePremiumIndexOne }));

import { fetchBinanceMarkPrices, toBinanceMarkPriceTick, toBinanceSymbol } from "./binance-mark-prices";

const BASE_URL = "https://fapi.binance.com";

/** Shape verified against the live API. */
const BTC_ROW = {
  symbol: "BTCUSDT",
  markPrice: "64799.90000000",
  indexPrice: "64823.44065217",
  estimatedSettlePrice: "64759.26285494",
  lastFundingRate: "0.00010000",
  interestRate: "0.00010000",
  nextFundingTime: 1785427200000,
  time: 1785422408000,
};

const ETH_ROW = { ...BTC_ROW, symbol: "ETHUSDT", markPrice: "3200.5" };

describe("toBinanceSymbol", () => {
  it("uppercases and trims", () => {
    expect(toBinanceSymbol(" btcusdt ")).toBe("BTCUSDT");
  });
});

describe("toBinanceMarkPriceTick", () => {
  it("maps every field the normalized tick declares", () => {
    expect(toBinanceMarkPriceTick(BTC_ROW, "BTCUSDT")).toEqual({
      provider: "binance",
      name: "BTCUSDT",
      markPrice: "64799.90000000",
      indexPrice: "64823.44065217",
      binanceLastFundingRate: "0.00010000",
      binanceNextFundingTime: 1785427200000,
      time: 1785422408000,
    });
  });

  it("preserves the decimal string exactly — never parsed to a float", () => {
    expect(toBinanceMarkPriceTick(BTC_ROW, "BTCUSDT").markPrice).toBe("64799.90000000");
  });
});

describe("fetchBinanceMarkPrices", () => {
  beforeEach(() => {
    fetchBinancePremiumIndexAll.mockReset();
    fetchBinancePremiumIndexOne.mockReset();
  });

  /** The single-symbol form is measured weight 1; the all-symbols form is 10. */
  it("uses the cheap single-symbol form for exactly one name", async () => {
    fetchBinancePremiumIndexOne.mockResolvedValue(BTC_ROW);

    const ticks = await fetchBinanceMarkPrices(BASE_URL, ["BTCUSDT"]);

    expect(fetchBinancePremiumIndexOne).toHaveBeenCalledWith(BASE_URL, "BTCUSDT");
    expect(fetchBinancePremiumIndexAll).not.toHaveBeenCalled();
    expect(ticks).toHaveLength(1);
  });

  it("falls back to the all-symbols form and filters for several names", async () => {
    fetchBinancePremiumIndexAll.mockResolvedValue([BTC_ROW, ETH_ROW]);

    const ticks = await fetchBinanceMarkPrices(BASE_URL, ["ETHUSDT", "BTCUSDT"]);

    expect(fetchBinancePremiumIndexOne).not.toHaveBeenCalled();
    expect(ticks.map((t) => t.name)).toEqual(["ETHUSDT", "BTCUSDT"]);
  });

  it("returns every market when no names are supplied", async () => {
    fetchBinancePremiumIndexAll.mockResolvedValue([BTC_ROW, ETH_ROW]);

    const ticks = await fetchBinanceMarkPrices(BASE_URL);

    expect(ticks.map((t) => t.name)).toEqual(["BTCUSDT", "ETHUSDT"]);
  });

  it("hands back the caller's exact spelling so a find() by name always hits", async () => {
    fetchBinancePremiumIndexOne.mockResolvedValue(BTC_ROW);

    const [tick] = await fetchBinanceMarkPrices(BASE_URL, ["btcusdt"]);

    expect(fetchBinancePremiumIndexOne).toHaveBeenCalledWith(BASE_URL, "BTCUSDT");
    expect(tick?.name).toBe("btcusdt");
  });

  it("omits an unlisted name rather than throwing", async () => {
    fetchBinancePremiumIndexOne.mockResolvedValue(null);

    expect(await fetchBinanceMarkPrices(BASE_URL, ["NOPEUSDT"])).toEqual([]);
  });

  /**
   * A `"::"` name is a lowcap artifact. Stripping it to a bare ticker would
   * fabricate a plausible Binance symbol and could return a confidently wrong
   * price for a different asset, so it is never requested at all.
   */
  it("never sends a `::`-suffixed lowcap name to Binance", async () => {
    fetchBinancePremiumIndexAll.mockResolvedValue([BTC_ROW]);

    const ticks = await fetchBinanceMarkPrices(BASE_URL, ["TIBBIR::A4..00_SFLOW"]);

    expect(ticks).toEqual([]);
    expect(fetchBinancePremiumIndexOne).not.toHaveBeenCalled();
  });

  it("still prices the requestable names alongside a `::` one", async () => {
    fetchBinancePremiumIndexOne.mockResolvedValue(BTC_ROW);

    const ticks = await fetchBinanceMarkPrices(BASE_URL, ["BTCUSDT", "TIBBIR::A4..00_SFLOW"]);

    expect(fetchBinancePremiumIndexOne).toHaveBeenCalledWith(BASE_URL, "BTCUSDT");
    expect(ticks.map((t) => t.name)).toEqual(["BTCUSDT"]);
  });
});
