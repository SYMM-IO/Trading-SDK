import { describe, expect, it } from "vitest";
import { ListingDepositChainId, ListingMarketStatus, PoolPositionSide } from "../types";
import { MarketStatus, type GetMarketResponseSchema } from "../types/generated/listing-backend";
import { toListingMarketDetail } from "./to-listing-market-detail";

/** A live SYMM detail row, trimmed to the fields under test. */
function makeRow(overrides: Partial<GetMarketResponseSchema> = {}): GetMarketResponseSchema {
  return {
    token_contract_address: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
    token_name: "Symmio",
    token_ticker: "SYMM",
    token_decimal: 18,
    symbol_id: 1,
    deposit_chain: ListingDepositChainId.BASE,
    market_status: MarketStatus.listed,
    max_leverage: 18,
    buyback_ratio: 50,
    listing_time: 1772715579,
    age: 1776084720,
    active_lps: 55,
    tvl: "436590910442466678775861",
    total_usdc_in_pool: "14340638353162345849846",
    total_token_in_pool: "38635451216126673641847703",
    maintenance_fees: "0",
    reward_1h: "0",
    reward_6h: "0",
    reward_24h: "0",
    reward_30d: "0",
    reward_lifetime: "5644635058100607065836",
    solver_revenue_1h: "0",
    solver_revenue_6h: "0",
    solver_revenue_24h: "0",
    solver_revenue_30d: "0",
    solver_revenue_lifetime: "0",
    apy_1h: "0",
    apy_6h: "0",
    apy_24h: "0",
    apy_30d: "4743902388478991319",
    apy_lifetime: "3466957350816584243",
    long_position_amount: "8371837985641000000000000",
    long_position_value: "69084894679122888410802",
    long_position_avg_open_price: "8252058245467028",
    long_position_upnl: "22411664984426494286154.904298000000",
    short_position_amount: "761293150867000000000000",
    short_position_value: "8239603301588694897930",
    short_position_avg_open_price: "10823167517276372",
    short_position_upnl: "-80637046973269407544.810478000000",
    ...overrides,
  } as GetMarketResponseSchema;
}

describe("toListingMarketDetail", () => {
  it("maps identity, status and scalar stats", () => {
    const detail = toListingMarketDetail(makeRow());

    expect(detail).toMatchObject({
      tokenTicker: "SYMM",
      symbolId: 1,
      depositChain: ListingDepositChainId.BASE,
      marketStatus: ListingMarketStatus.LISTED,
      activeLps: 55,
      buybackRatio: 50,
      tvl: 436590910442466678775861n,
    });
  });

  it("maps every window of each series, lifetime included", () => {
    const detail = toListingMarketDetail(makeRow());

    expect(detail.apy.d30).toBe(4743902388478991319n);
    expect(detail.apy.lifetime).toBe(3466957350816584243n);
    expect(detail.rewards.lifetime).toBe(5644635058100607065836n);
  });

  it("truncates the fractional tail the backend puts on uPnL", () => {
    const detail = toListingMarketDetail(makeRow());

    /** The wire value is `…286154.904298000000`; a fraction would make BigInt throw. */
    expect(detail.longPosition?.upnl).toBe(22411664984426494286154n);
  });

  it("keeps a losing side's uPnL negative", () => {
    const detail = toListingMarketDetail(makeRow());

    expect(detail.shortPosition?.upnl).toBe(-80637046973269407544n);
    expect(detail.shortPosition?.side).toBe(PoolPositionSide.SHORT);
  });

  it("reports a side the backend omitted as null rather than an empty row", () => {
    const detail = toListingMarketDetail(makeRow({ short_position_amount: null }));

    expect(detail.shortPosition).toBeNull();
    expect(detail.longPosition).not.toBeNull();
  });

  it("keeps a delisted pool's zero tvl distinct from an absent one", () => {
    expect(toListingMarketDetail(makeRow({ tvl: "0" })).tvl).toBe(0n);
    expect(toListingMarketDetail(makeRow({ tvl: null })).tvl).toBeNull();
  });
});
