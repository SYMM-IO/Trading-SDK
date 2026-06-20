import { describe, expect, it } from "vitest";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { makeOptimisticQuote, makeUnifiedQuote, TEST_VA } from "../unified-quote.test";
import { groupQuotes } from "./group-quotes";

const ethLong = makeUnifiedQuote({ key: "onchain:1", symbolId: 1n, positionType: PositionType.LONG });
const ethShort = makeUnifiedQuote({ key: "onchain:2", symbolId: 1n, positionType: PositionType.SHORT });
const ethLong2 = makeUnifiedQuote({ key: "onchain:3", symbolId: 1n, positionType: PositionType.LONG });
const btcLong = makeUnifiedQuote({ key: "onchain:4", symbolId: 2n, positionType: PositionType.LONG });

describe("groupQuotes — MARKET_DIRECTION", () => {
  it("separates long and short of the same market into distinct groups", () => {
    const groups = groupQuotes([ethLong, ethShort], SubAccountIsolationType.MARKET_DIRECTION);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => !group.isAggregate)).toBe(true);
    expect(new Set(groups.map((group) => group.key))).toEqual(
      new Set([`md:1:${PositionType.LONG}`, `md:1:${PositionType.SHORT}`]),
    );
  });

  it("folds multiple same-market same-side quotes into one aggregate group", () => {
    const groups = groupQuotes([ethLong, ethLong2], SubAccountIsolationType.MARKET_DIRECTION);
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.isAggregate).toBe(true);
    expect(group.quotes).toHaveLength(2);
    expect(group.by).toEqual({ symbolId: 1n, positionType: PositionType.LONG });
    expect(group.metrics.openQuantity).toBe(ethLong.openQuantity + ethLong2.openQuantity);
  });
});

describe("groupQuotes — other strategies", () => {
  it("MARKET collapses both sides of a market into one group", () => {
    const groups = groupQuotes([ethLong, ethShort], SubAccountIsolationType.MARKET);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("m:1");
    expect(groups[0]!.quotes).toHaveLength(2);
  });

  it("POSITION yields one (non-aggregate) group per quote", () => {
    const groups = groupQuotes([ethLong, ethLong2], SubAccountIsolationType.POSITION);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => !group.isAggregate)).toBe(true);
    expect(new Set(groups.map((group) => group.key))).toEqual(new Set(["onchain:1", "onchain:3"]));
  });

  it("accepts a custom keyOf (e.g. group by Virtual Account)", () => {
    const groups = groupQuotes([ethLong, ethShort, btcLong], {
      keyOf: (quote) => ({ key: `va:${quote.vaAddress}`, by: { vaAddress: quote.vaAddress } }),
    });
    // every fixture shares the default TEST_VA, so they all collapse into one group
    expect(groups).toHaveLength(1);
    expect(groups[0]!.quotes).toHaveLength(3);
  });
});

describe("groupQuotes — group metadata & ordering", () => {
  it("resolves vaAddress from the on-chain child when an optimistic twin has none", () => {
    const optimistic = makeOptimisticQuote({ key: "temp:1", symbolId: 1n, positionType: PositionType.LONG });
    expect(optimistic.vaAddress).toBeUndefined();
    const group = groupQuotes([optimistic, ethLong], SubAccountIsolationType.MARKET_DIRECTION)[0]!;
    expect(group.vaAddress).toBe(TEST_VA);
  });

  it("orders groups newest-first and sorts each group's quotes newest-first", () => {
    const older = makeUnifiedQuote({ key: "onchain:1", symbolId: 1n, statusModifyTimestamp: 1_000n });
    const newer = makeUnifiedQuote({ key: "onchain:3", symbolId: 1n, statusModifyTimestamp: 3_000n });
    const otherMarket = makeUnifiedQuote({ key: "onchain:4", symbolId: 2n, statusModifyTimestamp: 2_000n });

    const groups = groupQuotes([older, newer, otherMarket], SubAccountIsolationType.MARKET_DIRECTION);
    // ETH group (newest child 3000) before BTC group (2000)
    expect(groups.map((group) => group.by.symbolId)).toEqual([1n, 2n]);
    // within the ETH group, the 3000 quote leads
    expect(groups[0]!.quotes.map((quote) => quote.key)).toEqual(["onchain:3", "onchain:1"]);
  });

  it("honors a custom group sort", () => {
    const groups = groupQuotes([btcLong, ethLong], SubAccountIsolationType.MARKET_DIRECTION, {
      sort: (a, b) => Number((a.by.symbolId ?? 0n) - (b.by.symbolId ?? 0n)),
    });
    expect(groups.map((group) => group.by.symbolId)).toEqual([1n, 2n]);
  });

  it("returns an empty array for empty input", () => {
    expect(groupQuotes([], SubAccountIsolationType.MARKET_DIRECTION)).toEqual([]);
  });
});
