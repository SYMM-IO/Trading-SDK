import { describe, expect, it } from "vitest";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import { MarketStatus, type MarketSearchItem } from "../types/generated/listing-backend";
import { toListingMarket, toListingMarketPage, toListingValue } from "./to-listing-market";

/** A live `SYMM` row, trimmed to the fields under test. */
function makeRow(overrides: Partial<MarketSearchItem> = {}): MarketSearchItem {
  return {
    contract_address: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
    chain_id: ListingDepositChainId.BASE,
    symbol_id: 1,
    token_ticker: "SYMM",
    token_name: "Symmio",
    max_leverage: 18,
    market_cap: "8262743000000000000000000",
    vol24h: "36916359374753173167",
    apr_1h: "0",
    apr_6h: "0",
    apr_24h: "0",
    apr_30d: "0",
    reward_24h: "0",
    apr: "0",
    tvl_driven_apy_1h: "1165118687123974320",
    tvl_driven_apy_6h: "-468447124062793438",
    tvl_driven_apy_24h: "-21127968528085749507",
    tvl_driven_apy_30d: "-9384529698578156963",
    tvl_driven_apy_lifetime: "-25485123375090497065",
    price_driven_apy_1h: "1245347485730255417",
    price_driven_apy_6h: "-500147766129031095",
    price_driven_apy_24h: "6652282998687522029",
    price_driven_apy_30d: "57061092087612607535",
    price_driven_apy_lifetime: "27438825324492723831",
    liquidity: "208438031756981981831",
    tvl: "71036417337070986131",
    open_interest: "52811628682812151810",
    listing_time: 1772715579,
    market_status: MarketStatus.listed,
    ...overrides,
  };
}

describe("toListingValue", () => {
  it("parses an 18-decimal string without losing precision", () => {
    expect(toListingValue("8262743000000000000000000")).toBe(8262743000000000000000000n);
  });

  it("preserves negative values, which the service returns despite its schema", () => {
    expect(toListingValue("-25485123375090497065")).toBe(-25485123375090497065n);
  });

  it("distinguishes an absent figure from zero", () => {
    expect(toListingValue(null)).toBeNull();
    expect(toListingValue(undefined)).toBeNull();
    expect(toListingValue("")).toBeNull();
    expect(toListingValue("   ")).toBeNull();
    expect(toListingValue("0")).toBe(0n);
  });

  it("truncates a fractional tail toward zero instead of throwing", () => {
    expect(toListingValue("123.9")).toBe(123n);
    expect(toListingValue("-123.9")).toBe(-123n);
  });

  it("applies scientific notation instead of reading it as zero", () => {
    /**
     * The backend serializes uPnL as a Python `Decimal`, so zero arrives as
     * `0E-36`. Every live instance is zero today — which is exactly why a
     * parser that rejected the form would look correct while silently zeroing
     * the first non-zero value that ever appears.
     */
    expect(toListingValue("0E-36")).toBe(0n);
    expect(toListingValue("1.5E+21")).toBe(1500000000000000000000n);
    expect(toListingValue("-2.5E+3")).toBe(-2500n);
    /** Below one after the shift, so it truncates toward zero rather than rounding. */
    expect(toListingValue("1.5E-18")).toBe(0n);
    expect(toListingValue("9E0")).toBe(9n);
  });

  it("returns null for a value it cannot parse", () => {
    expect(toListingValue("not-a-number")).toBeNull();
    expect(toListingValue("")).toBeNull();
    /** An exponent with no digits is malformed, unlike the well-formed `1e18`. */
    expect(toListingValue("1e")).toBeNull();
  });
});

describe("toListingMarket", () => {
  it("maps identity, status, and scalar value fields", () => {
    const market = toListingMarket(makeRow());

    expect(market.contractAddress).toBe("0x800822d361335b4d5F352Dac293cA4128b5B605f");
    expect(market.chainId).toBe(ListingDepositChainId.BASE);
    expect(market.symbolId).toBe(1);
    expect(market.tokenTicker).toBe("SYMM");
    expect(market.tokenName).toBe("Symmio");
    expect(market.maxLeverage).toBe(18);
    expect(market.marketStatus).toBe(ListingMarketStatus.LISTED);
    expect(market.listingTime).toBe(1772715579);
    expect(market.marketCap).toBe(8262743000000000000000000n);
    expect(market.tvl).toBe(71036417337070986131n);
    expect(market.liquidity).toBe(208438031756981981831n);
    expect(market.openInterest).toBe(52811628682812151810n);
    expect(market.vol24h).toBe(36916359374753173167n);
  });

  it("maps each APY series onto its own window keys, lifetime included", () => {
    const market = toListingMarket(makeRow());

    expect(market.tvlDrivenApy).toEqual({
      h1: 1165118687123974320n,
      h6: -468447124062793438n,
      h24: -21127968528085749507n,
      d30: -9384529698578156963n,
      lifetime: -25485123375090497065n,
    });
    expect(market.priceDrivenApy).toEqual({
      h1: 1245347485730255417n,
      h6: -500147766129031095n,
      h24: 6652282998687522029n,
      d30: 57061092087612607535n,
      lifetime: 27438825324492723831n,
    });
  });

  it("maps APR windows without a lifetime column", () => {
    const market = toListingMarket(makeRow({ apr_1h: "5", apr_6h: "6", apr_24h: "7", apr_30d: "8" }));

    expect(market.aprByWindow).toEqual({ h1: 5n, h6: 6n, h24: 7n, d30: 8n });
    expect(market.aprByWindow).not.toHaveProperty("lifetime");
  });

  it("keeps a not-yet-listed market's absent fields null rather than zero", () => {
    const market = toListingMarket(
      makeRow({
        symbol_id: null,
        listing_time: null,
        tvl: null,
        apr_30d: null,
        tvl_driven_apy_30d: null,
        market_status: MarketStatus.under_review,
      }),
    );

    expect(market.symbolId).toBeNull();
    expect(market.listingTime).toBeNull();
    expect(market.tvl).toBeNull();
    expect(market.aprByWindow.d30).toBeNull();
    expect(market.tvlDrivenApy.d30).toBeNull();
    expect(market.marketStatus).toBe(ListingMarketStatus.UNDER_REVIEW);
  });

  it("keeps a Solana row's base58 address intact", () => {
    const market = toListingMarket(
      makeRow({
        contract_address: "GvUCjmWSXA5hrTh9smmNA1AU55YCtP9mDLQcrKA1pump",
        chain_id: ListingDepositChainId.SOLANA,
      }),
    );

    expect(market.contractAddress).toBe("GvUCjmWSXA5hrTh9smmNA1AU55YCtP9mDLQcrKA1pump");
    expect(market.chainId).toBe(ListingDepositChainId.SOLANA);
  });
});

describe("rate scale", () => {
  /**
   * A descaled rate **is** the percentage (`1e18` = `1%`), not a fraction. Pinned
   * against real service data because getting it wrong is invisible in types and
   * renders a -0.76% APY as -75.78%.
   *
   * The live GNS row: `tvl` 177.780672757100936905, `reward_24h`
   * 0.005501490474301440 — a 24h yield of 3.0946e-5, which annualizes to
   * 1.1295%. Its reported `apr_24h` descales to exactly that.
   */
  it("descales a rate straight to a percentage, matching the backend's own arithmetic", () => {
    const market = toListingMarket(
      makeRow({
        tvl: "177780672757100936905",
        reward_24h: "5501490474301440",
        apr_24h: "1129506369831092972",
      }),
    );

    const SCALE = 10 ** 18;
    const tvl = Number(market.tvl) / SCALE;
    const reward24h = Number(market.reward24h) / SCALE;
    const annualizedPercent = (reward24h / tvl) * 365 * 100;
    const reportedPercent = Number(market.aprByWindow.h24) / SCALE;

    expect(reportedPercent).toBeCloseTo(annualizedPercent, 3);
    expect(reportedPercent).toBeCloseTo(1.1295, 4);
  });
});

describe("toListingMarketPage", () => {
  it("maps the envelope and every row", () => {
    const page = toListingMarketPage({ total: 271, limit: 2, offset: 20, items: [makeRow()] });

    expect(page).toMatchObject({ total: 271, limit: 2, offset: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.tokenTicker).toBe("SYMM");
  });

  it("defaults every optional envelope field", () => {
    expect(toListingMarketPage({})).toEqual({ total: 0, limit: 0, offset: 0, items: [] });
  });
});
