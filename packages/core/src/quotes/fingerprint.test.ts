import { describe, expect, it } from "vitest";
import { OrderType, PositionType } from "../symmio-contracts/symmio/types";
import { fingerprintQuote } from "./fingerprint";
import { makeOptimisticQuote, makeUnifiedQuote } from "./unified-quote.test";

describe("fingerprintQuote", () => {
  /**
   * Pins the exact field set AND order: [orderType, positionType, cva, lf,
   * quantity, requestedOpenPrice] colon-joined. The default fixture is a MARKET
   * (1) LONG (0) quote, so any reordering or added/removed field breaks this.
   */
  it("is the colon-join of orderType, positionType, cva, lf, quantity, requestedOpenPrice", () => {
    const quote = makeUnifiedQuote();
    expect(fingerprintQuote(quote)).toBe(
      [
        OrderType.MARKET,
        PositionType.LONG,
        quote.lockedValues.cva,
        quote.lockedValues.lf,
        quote.quantity,
        quote.requestedOpenPrice,
      ].join(":"),
    );
  });

  /**
   * The dedup contract reconcileQuotes relies on: the off-chain optimistic view
   * and the on-chain view of the SAME trade must fingerprint identically even
   * though their key/origin/quoteId/tempQuoteId differ. The optimistic fixture
   * zeroes lockedValues, so the on-chain row must share those zeros to match.
   */
  it("produces an identical fingerprint for the off-chain and on-chain views of the same trade", () => {
    const shared = {
      orderType: OrderType.MARKET,
      positionType: PositionType.LONG,
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
      quantity: 3_000000000000000000n,
      requestedOpenPrice: 1_500_000000000000000000n,
    };
    const optimistic = makeOptimisticQuote(shared);
    const onchain = makeUnifiedQuote(shared);
    expect(optimistic.key).not.toBe(onchain.key);
    expect(optimistic.origin).not.toBe(onchain.origin);
    expect(optimistic.quoteId).toBeUndefined();
    expect(onchain.quoteId).toBeDefined();
    expect(fingerprintQuote(optimistic)).toBe(fingerprintQuote(onchain));
  });

  /** Changing orderType (LIMIT vs the default MARKET) changes the fingerprint. */
  it("differs when orderType changes", () => {
    expect(fingerprintQuote(makeUnifiedQuote({ orderType: OrderType.LIMIT }))).not.toBe(
      fingerprintQuote(makeUnifiedQuote({ orderType: OrderType.MARKET })),
    );
  });

  /** Changing positionType (SHORT vs the default LONG) changes the fingerprint. */
  it("differs when positionType changes", () => {
    expect(fingerprintQuote(makeUnifiedQuote({ positionType: PositionType.SHORT }))).not.toBe(
      fingerprintQuote(makeUnifiedQuote({ positionType: PositionType.LONG })),
    );
  });

  /** Changing lockedValues.cva changes the fingerprint. */
  it("differs when lockedValues.cva changes", () => {
    expect(
      fingerprintQuote(
        makeUnifiedQuote({
          lockedValues: { cva: 99_000000000000000000n, lf: 2_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
        }),
      ),
    ).not.toBe(fingerprintQuote(makeUnifiedQuote()));
  });

  /** Changing lockedValues.lf changes the fingerprint. */
  it("differs when lockedValues.lf changes", () => {
    expect(
      fingerprintQuote(
        makeUnifiedQuote({
          lockedValues: { cva: 10_000000000000000000n, lf: 99_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
        }),
      ),
    ).not.toBe(fingerprintQuote(makeUnifiedQuote()));
  });

  /** Changing quantity changes the fingerprint. */
  it("differs when quantity changes", () => {
    expect(fingerprintQuote(makeUnifiedQuote({ quantity: 7_000000000000000000n }))).not.toBe(
      fingerprintQuote(makeUnifiedQuote({ quantity: 1_000000000000000000n })),
    );
  });

  /** Changing requestedOpenPrice changes the fingerprint. */
  it("differs when requestedOpenPrice changes", () => {
    expect(fingerprintQuote(makeUnifiedQuote({ requestedOpenPrice: 3_000_000000000000000000n }))).not.toBe(
      fingerprintQuote(makeUnifiedQuote({ requestedOpenPrice: 2_000_000000000000000000n })),
    );
  });

  /**
   * Non-contributing fields must NOT change the fingerprint: quoteId,
   * openedPrice, symbolId, partyA, and statusModifyTimestamp are all outside the
   * six-field set, so two rows differing only in these dedup to the same trade.
   */
  it("is unchanged by non-contributing fields (quoteId, openedPrice, symbolId, partyA, statusModifyTimestamp)", () => {
    const base = makeUnifiedQuote();
    const varied = makeUnifiedQuote({
      quoteId: 999n,
      key: "onchain:999",
      openedPrice: 4_242_000000000000000000n,
      symbolId: 77n,
      partyA: "0x9999999999999999999999999999999999999999",
      statusModifyTimestamp: 9_999n,
    });
    expect(fingerprintQuote(varied)).toBe(fingerprintQuote(base));
  });

  /**
   * partyAmm and partyBmm live on lockedValues alongside cva/lf, but ONLY cva and
   * lf feed the fingerprint — assert that varying the mm fields leaves it equal.
   */
  it("ignores lockedValues.partyAmm and lockedValues.partyBmm", () => {
    const base = makeUnifiedQuote({
      lockedValues: { cva: 10_000000000000000000n, lf: 2_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
    });
    const variedMm = makeUnifiedQuote({
      lockedValues: {
        cva: 10_000000000000000000n,
        lf: 2_000000000000000000n,
        partyAmm: 5_000000000000000000n,
        partyBmm: 6_000000000000000000n,
      },
    });
    expect(fingerprintQuote(variedMm)).toBe(fingerprintQuote(base));
  });
});
