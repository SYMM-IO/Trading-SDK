import { describe, expect, it } from "vitest";
import { PoolPositionSide, type ListingMarketDetail, type PoolPosition } from "../types";
import { toPoolPositions } from "./to-pool-positions";

function makePosition(side: PoolPositionSide, size: bigint): PoolPosition {
  return { side, size, value: 1n, avgOpenPrice: 2n, upnl: -3n };
}

function makeDetail(overrides: Partial<ListingMarketDetail> = {}): ListingMarketDetail {
  return {
    longPosition: makePosition(PoolPositionSide.LONG, 10n),
    shortPosition: makePosition(PoolPositionSide.SHORT, 20n),
    ...overrides,
  } as ListingMarketDetail;
}

describe("toPoolPositions", () => {
  it("returns long before short", () => {
    expect(toPoolPositions(makeDetail()).map((row) => row.side)).toEqual([
      PoolPositionSide.LONG,
      PoolPositionSide.SHORT,
    ]);
  });

  it("omits a side the backend reported nothing for", () => {
    const rows = toPoolPositions(makeDetail({ shortPosition: null }));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.side).toBe(PoolPositionSide.LONG);
  });

  it("returns nothing when the pool holds no inventory at all", () => {
    expect(toPoolPositions(makeDetail({ longPosition: null, shortPosition: null }))).toEqual([]);
  });

  it("keeps a zero-size side, which is not the same as an absent one", () => {
    const rows = toPoolPositions(makeDetail({ shortPosition: makePosition(PoolPositionSide.SHORT, 0n) }));

    expect(rows).toHaveLength(2);
    expect(rows[1]?.size).toBe(0n);
  });
});
