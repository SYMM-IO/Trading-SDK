import { describe, expect, it } from "vitest";
import { ListingDepositChainId, ListingMarketStatus } from "../types";
import { MarketStatus, type UserMarketSearchItem } from "../types/generated/listing-backend";
import { toUserListingMarket, toUserListingMarketPage } from "./to-user-listing-market";

/** A live "Your Pools" row, trimmed to the fields under test. */
function makeRow(overrides: Partial<UserMarketSearchItem> = {}): UserMarketSearchItem {
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
    user_deposit: "5000000000000000000",
    user_share_percentage: 12.5,
    user_revenue: "250000000000000000",
    ...overrides,
  };
}

describe("toUserListingMarket", () => {
  it("maps the base market fields via toListingMarket", () => {
    const market = toUserListingMarket(makeRow());

    expect(market.contractAddress).toBe("0x800822d361335b4d5F352Dac293cA4128b5B605f");
    expect(market.chainId).toBe(ListingDepositChainId.BASE);
    expect(market.symbolId).toBe(1);
    expect(market.tokenTicker).toBe("SYMM");
    expect(market.tokenName).toBe("Symmio");
    expect(market.maxLeverage).toBe(18);
    expect(market.marketStatus).toBe(ListingMarketStatus.LISTED);
    expect(market.tvl).toBe(71036417337070986131n);
    expect(market.tvlDrivenApy).toEqual({
      h1: 1165118687123974320n,
      h6: -468447124062793438n,
      h24: -21127968528085749507n,
      d30: -9384529698578156963n,
      lifetime: -25485123375090497065n,
    });
  });

  it("maps the user-scoped deposit, share, and revenue fields", () => {
    const market = toUserListingMarket(makeRow());

    expect(market.userDeposit).toBe(5000000000000000000n);
    expect(market.userSharePercentage).toBe(12.5);
    expect(market.userRevenue).toBe(250000000000000000n);
  });

  it("keeps a deposit address with nothing deposited yet as null, not zero", () => {
    const market = toUserListingMarket(makeRow({ user_deposit: null, user_revenue: null }));

    expect(market.userDeposit).toBeNull();
    expect(market.userRevenue).toBeNull();
  });

  it("normalizes the absent reward_24h column to null", () => {
    const market = toUserListingMarket(makeRow());

    expect(market.reward24h).toBeNull();
  });
});

describe("toUserListingMarketPage", () => {
  it("maps the envelope and every row", () => {
    const page = toUserListingMarketPage({ total: 3, limit: 2, offset: 20, items: [makeRow()] });

    expect(page).toMatchObject({ total: 3, limit: 2, offset: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.tokenTicker).toBe("SYMM");
    expect(page.items[0]?.userDeposit).toBe(5000000000000000000n);
  });

  it("defaults every optional envelope field", () => {
    expect(toUserListingMarketPage({})).toEqual({ total: 0, limit: 0, offset: 0, items: [] });
  });
});
