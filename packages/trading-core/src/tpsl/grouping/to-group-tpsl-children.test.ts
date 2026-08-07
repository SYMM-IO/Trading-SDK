import { describe, expect, it } from "vitest";
import { makeUnifiedQuote } from "../../quotes/unified-quote.test";
import { PositionType } from "../../symmio-contracts/symmio/types";
import type { QuoteTpSl } from "../types";
import { toGroupTpSlChildren } from "./to-group-tpsl-children";
import type { GroupTpSlChild } from "./types";

/** A TP/SL snapshot with no orders on either side. */
export function makeBlankTpSl(overrides: Partial<QuoteTpSl> = {}): QuoteTpSl {
  return {
    tp: "",
    sl: "",
    tpOpenPrice: "",
    slOpenPrice: "",
    tpPriceType: "markPrice",
    slPriceType: "markPrice",
    tpState: "canceled",
    slState: "canceled",
    ...overrides,
  };
}

/**
 * Shared child factory for the grouped TP/SL tests. Defaults describe a 1-unit
 * LONG opened at 100 with no conditional orders.
 */
export function makeGroupTpSlChild(overrides: Partial<GroupTpSlChild> = {}): GroupTpSlChild {
  return {
    key: "onchain:1",
    quoteId: 1n,
    virtualAccount: "0x1111111111111111111111111111111111111111",
    symbolId: 7n,
    positionType: PositionType.LONG,
    openQuantity: 1_000000000000000000n,
    openPrice: 100_000000000000000000n,
    tpsl: makeBlankTpSl(),
    ...overrides,
  };
}

describe("toGroupTpSlChildren", () => {
  it("prefers the settled openedPrice and falls back to requestedOpenPrice", () => {
    const settled = makeUnifiedQuote({
      key: "onchain:1",
      openedPrice: 120_000000000000000000n,
      requestedOpenPrice: 100_000000000000000000n,
    });
    const unsettled = makeUnifiedQuote({
      key: "onchain:2",
      openedPrice: 0n,
      requestedOpenPrice: 100_000000000000000000n,
    });

    const children = toGroupTpSlChildren([settled, unsettled], () => undefined);

    expect(children[0]!.openPrice).toBe(120_000000000000000000n);
    expect(children[1]!.openPrice).toBe(100_000000000000000000n);
  });

  it("keeps an off-chain child with quoteId undefined so it still counts", () => {
    const quote = makeUnifiedQuote({ key: "temp:-5", quoteId: undefined, tempQuoteId: -5 });

    const [child] = toGroupTpSlChildren([quote], () => undefined);

    expect(child!.quoteId).toBeUndefined();
    expect(child!.key).toBe("temp:-5");
  });

  it("resolves virtualAccount as vaAddress ?? partyA", () => {
    const withVa = makeUnifiedQuote({
      key: "onchain:1",
      partyA: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      vaAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const withoutVa = makeUnifiedQuote({
      key: "onchain:2",
      partyA: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      vaAddress: undefined,
    });

    const children = toGroupTpSlChildren([withVa, withoutVa], () => undefined);

    expect(children[0]!.virtualAccount).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(children[1]!.virtualAccount).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("substitutes a blank snapshot when the lookup misses", () => {
    const [child] = toGroupTpSlChildren([makeUnifiedQuote({ key: "onchain:1" })], () => undefined);

    expect(child!.tpsl.tp).toBe("");
    expect(child!.tpsl.sl).toBe("");
    expect(child!.tpsl.tpState).toBe("canceled");
    expect(child!.tpsl.slState).toBe("canceled");
  });

  it("passes the resolved snapshot through and preserves input order", () => {
    const quotes = [
      makeUnifiedQuote({ key: "onchain:1" }),
      makeUnifiedQuote({ key: "onchain:2" }),
      makeUnifiedQuote({ key: "onchain:3" }),
    ];
    const snapshots: Record<string, QuoteTpSl> = {
      "onchain:2": makeBlankTpSl({ tp: "150", tpState: "new" }),
    };

    const children = toGroupTpSlChildren(quotes, (quote) => snapshots[quote.key]);

    expect(children.map((child) => child.key)).toEqual(["onchain:1", "onchain:2", "onchain:3"]);
    expect(children[1]!.tpsl.tp).toBe("150");
  });
});
