import { describe, expect, it } from "vitest";
import { toQuoteEventRow, type RawQuoteEventNode } from "./to-quote-event-row";
import { QuoteEventType } from "./types";

function makeNode(overrides?: Partial<RawQuoteEventNode>): RawQuoteEventNode {
  return {
    id: "0xevent-1",
    type: QuoteEventType.ChargeFundingRate,
    metadata: null,
    timestamp: "1782000000",
    blockNumber: "12345",
    transaction: "0xabc",
    quoteId: "8232",
    ...overrides,
  };
}

describe("toQuoteEventRow", () => {
  it("decodes provenance fields regardless of metadata", () => {
    const row = toQuoteEventRow(makeNode());

    expect(row.eventId).toBe("0xevent-1");
    expect(row.quoteId).toBe(8232n);
    expect(row.type).toBe(QuoteEventType.ChargeFundingRate);
    expect(row.timestamp).toBe(1782000000);
    expect(row.blockNumber).toBe(12345n);
    expect(row.transaction).toBe("0xabc");
  });

  it("decodes every recognized funding field from the metadata JSON", () => {
    const metadata = JSON.stringify({
      fundingPaid: "1500000000000000000",
      fundingReceived: "0",
      rate: "250000000000000",
      newPrice: "2000000000000000000",
      prevPrice: "1990000000000000000",
      openQuantity: "30000000000000000000",
    });
    const row = toQuoteEventRow(makeNode({ metadata }));

    expect(row.fundingPaid).toBe(1500000000000000000n);
    expect(row.fundingReceived).toBe(0n);
    expect(row.rate).toBe(250000000000000n);
    expect(row.newPrice).toBe(2000000000000000000n);
    expect(row.prevPrice).toBe(1990000000000000000n);
    expect(row.openQuantity).toBe(30000000000000000000n);
    expect(row.rawMetadata).toBe(metadata);
  });

  it("decodes the price-recompute fields of a SETTLE_UPNL event", () => {
    const metadata = JSON.stringify({
      newPrice: "1566606403332106474",
      prevPrice: "1540607343898375663",
      openQuantity: "5000000000000000000",
    });
    const row = toQuoteEventRow(makeNode({ type: QuoteEventType.SettleUpnl, metadata }));

    expect(row.type).toBe(QuoteEventType.SettleUpnl);
    expect(row.newPrice).toBe(1566606403332106474n);
    expect(row.prevPrice).toBe(1540607343898375663n);
    expect(row.openQuantity).toBe(5000000000000000000n);
    /** Funding-only fields are absent from a SETTLE_UPNL snapshot. */
    expect(row.fundingPaid).toBeUndefined();
    expect(row.rate).toBeUndefined();
  });

  it("preserves a signed int256 funding rate", () => {
    const row = toQuoteEventRow(makeNode({ metadata: JSON.stringify({ rate: "-500000000000000" }) }));
    expect(row.rate).toBe(-500000000000000n);
  });

  it("accepts numeric (non-string) metadata values", () => {
    const row = toQuoteEventRow(makeNode({ metadata: JSON.stringify({ openQuantity: 42 }) }));
    expect(row.openQuantity).toBe(42n);
  });

  it("leaves every metadata field undefined and rawMetadata null when metadata is absent", () => {
    const row = toQuoteEventRow(makeNode({ metadata: null }));

    expect(row.rawMetadata).toBeNull();
    expect(row.newPrice).toBeUndefined();
    expect(row.prevPrice).toBeUndefined();
    expect(row.openQuantity).toBeUndefined();
    expect(row.fundingPaid).toBeUndefined();
    expect(row.fundingReceived).toBeUndefined();
    expect(row.rate).toBeUndefined();
  });

  it("ignores malformed metadata JSON but keeps the raw string", () => {
    const row = toQuoteEventRow(makeNode({ metadata: "{not json" }));

    expect(row.rawMetadata).toBe("{not json");
    expect(row.newPrice).toBeUndefined();
    expect(row.fundingPaid).toBeUndefined();
  });

  it("treats empty, null, and unparsable wei fields as undefined", () => {
    const row = toQuoteEventRow(
      makeNode({
        metadata: JSON.stringify({ newPrice: "", prevPrice: null, openQuantity: "  ", rate: "not-a-number" }),
      }),
    );

    expect(row.newPrice).toBeUndefined();
    expect(row.prevPrice).toBeUndefined();
    expect(row.openQuantity).toBeUndefined();
    expect(row.rate).toBeUndefined();
  });

  it("maps a missing blockNumber and transaction to undefined", () => {
    const row = toQuoteEventRow(makeNode({ blockNumber: "", transaction: "" }));
    expect(row.blockNumber).toBeUndefined();
    expect(row.transaction).toBeUndefined();
  });

  it("defaults a missing quoteId to 0n", () => {
    const row = toQuoteEventRow(makeNode({ quoteId: "" }));
    expect(row.quoteId).toBe(0n);
  });
});
