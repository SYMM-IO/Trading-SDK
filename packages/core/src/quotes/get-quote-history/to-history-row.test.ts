import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { OrderType, PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import { toQuoteHistoryRow, type RawQuoteEventRow } from "./to-history-row";

const PARTY_A = "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a";
const PARTY_B = "0x76bc5889c0cfcc20960b0d81f541595d81a95122";
const SUB_ACCOUNT = "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a";

function makeRow(overrides?: {
  type?: string;
  metadata?: string | null;
  quote?: Partial<RawQuoteEventRow["quote"]>;
}): RawQuoteEventRow {
  return {
    id: "0xevent-25-8232",
    type: overrides?.type ?? "FILL_CLOSE",
    metadata: overrides?.metadata ?? null,
    timestamp: "1782000124",
    quoteId: "8232",
    blockNumber: "12345",
    transaction: "0xabc",
    quote: {
      quoteId: "8232",
      quoteStatus: 4,
      positionType: 0,
      orderTypeOpen: 1,
      symbol: "LIT::CH_SFLOW",
      symbolId: "149",
      partyA: PARTY_A,
      partyB: PARTY_B,
      quantity: "30000000000000000000",
      openedPrice: "1000000000000000000",
      requestedOpenPrice: "1010000000000000000",
      averageClosedPrice: "2000000000000000000",
      closePrice: "0",
      closedAmount: "5000000000000000000",
      quantityToClose: "0",
      liquidateAmount: null,
      liquidatePrice: null,
      subAccount: { id: SUB_ACCOUNT },
      ...overrides?.quote,
    },
  };
}

describe("toQuoteHistoryRow", () => {
  it("overlays the FILL_CLOSE metadata snapshot onto the mutable quote", () => {
    const row = toQuoteHistoryRow(
      makeRow({
        type: "FILL_CLOSE",
        metadata: JSON.stringify({
          amount: "30631715000000000000",
          openedPrice: "1566606403332106474",
          closePrice: "1540607343898375663",
          quoteStatus: "7",
        }),
      }),
    );

    // Snapshot values win over the mutable quote fields.
    expect(row.closedAmount).toBe(30631715000000000000n);
    expect(row.quantityToClose).toBe(30631715000000000000n);
    expect(row.avgClosedPrice).toBe(1540607343898375663n);
    expect(row.openedPrice).toBe(1566606403332106474n);
    // Status is forced from the event type, not the mutable quote (4 = OPENED).
    expect(row.quoteStatus).toBe(QuoteStatus.CLOSED);
    expect(row.positionType).toBe(PositionType.LONG);
    expect(row.orderType).toBe(OrderType.MARKET);
    expect(row.marketId).toBe(149);
    expect(row.quoteId).toBe(8232n);
    expect(row.closedAt).toBe(1782000124);
    // Non-liquidation row leaves liquidation fields at the quote's (zero) values.
    expect(row.liquidateAmount).toBe(0n);
    expect(row.liquidatePrice).toBe(0n);
  });

  it("routes the snapshot into liquidation fields for a LIQUIDATE_PARTY_A event", () => {
    const row = toQuoteHistoryRow(
      makeRow({
        type: "LIQUIDATE_PARTY_A",
        metadata: JSON.stringify({ amount: "50000000000000000000", closePrice: "60000000000000000" }),
      }),
    );

    expect(row.quoteStatus).toBe(QuoteStatus.LIQUIDATED);
    expect(row.liquidateAmount).toBe(50000000000000000000n);
    expect(row.liquidatePrice).toBe(60000000000000000n);
    expect(row.closedAmount).toBe(50000000000000000000n);
    expect(row.avgClosedPrice).toBe(60000000000000000n);
  });

  it("falls back to the quote's mutable values when metadata is absent", () => {
    const row = toQuoteHistoryRow(makeRow({ type: "FORCE_CLOSE", metadata: null }));

    expect(row.closedAmount).toBe(5000000000000000000n);
    expect(row.quantityToClose).toBe(0n);
    expect(row.avgClosedPrice).toBe(2000000000000000000n);
    expect(row.openedPrice).toBe(1000000000000000000n);
    // Status still forced from the event type even with no snapshot.
    expect(row.quoteStatus).toBe(QuoteStatus.CLOSED);
  });

  it("ignores malformed metadata and non-positive snapshot fields", () => {
    const row = toQuoteHistoryRow(makeRow({ metadata: JSON.stringify({ amount: "0", closePrice: "not-a-number" }) }));
    // amount 0 and a non-numeric closePrice do not overwrite the quote values.
    expect(row.closedAmount).toBe(5000000000000000000n);
    expect(row.avgClosedPrice).toBe(2000000000000000000n);
  });

  it("checksums addresses and preserves raw metadata and provenance", () => {
    const meta = JSON.stringify({ amount: "1" });
    const row = toQuoteHistoryRow(makeRow({ metadata: meta }));

    expect(row.partyA).toBe(getAddress(PARTY_A));
    expect(row.partyB).toBe(getAddress(PARTY_B));
    expect(row.subAccount).toBe(getAddress(SUB_ACCOUNT));
    expect(row.blockNumber).toBe(12345n);
    expect(row.transaction).toBe("0xabc");
    expect(row.rawMetadata).toBe(meta);
    expect(row.eventId).toBe("0xevent-25-8232");
  });

  it("maps a missing partyB and subAccount to null", () => {
    const row = toQuoteHistoryRow(makeRow({ quote: { partyB: null, subAccount: null } }));
    expect(row.partyB).toBeNull();
    expect(row.subAccount).toBeNull();
  });
});
