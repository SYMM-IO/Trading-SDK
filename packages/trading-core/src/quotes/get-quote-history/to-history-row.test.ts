import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { OrderType, PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import { toQuoteHistoryRow, type RawQuoteEventRow } from "./to-history-row";

const PARTY_A = "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a";
const PARTY_B = "0x76bc5889c0cfcc20960b0d81f541595d81a95122";
const SUB_ACCOUNT = "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a";
const OWNER = "0x2e5546fe2bcdaf5ec9f76c6f5c1e9c5c0f5b1a11";
const DIAMOND = "0x8a0ed5b4cec4b0c4e1f7c8d9e3a2b1f0c9d8e7f6";

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
    source: DIAMOND,
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
      subAccount: { id: SUB_ACCOUNT, owner: OWNER },
      closedPrice: "1990000000000000000",
      initialOpenedPrice: "1005000000000000000",
      marketPrice: "1001000000000000000",
      tradingFee: "800000000000000",
      closeFee: "800000000000000",
      leverage: "5000000000000000000",
      cva: "1000000000000000000",
      lf: "500000000000000000",
      initialCva: "1200000000000000000",
      initialLf: "600000000000000000",
      initialPartyAmm: "4200000000000000000",
      timestampSendQuote: "1781990000",
      timestampOpenPosition: "1781990004",
      sendQuoteEvents: [{ transaction: "0xopen" }],
      openPositionEvents: [{ metadata: '{"solverFees":[["STATIC_SOLVER_FEE","10"]]}' }, { metadata: null }],
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
    expect(row.subAccountOwner).toBeNull();
  });

  it("decodes the quote's raw fields and relations as indexed", () => {
    const row = toQuoteHistoryRow(makeRow({ metadata: JSON.stringify({ closePrice: "2100000000000000000" }) }));

    expect(row.source).toBe(getAddress(DIAMOND));
    // The raw `closedPrice` is the quote's own value, not the event's snapshot.
    expect(row.closedPrice).toBe(1990000000000000000n);
    expect(row.avgClosedPrice).toBe(2100000000000000000n);
    expect(row.initialOpenedPrice).toBe(1005000000000000000n);
    expect(row.marketPrice).toBe(1001000000000000000n);
    expect(row.tradingFee).toBe(800000000000000n);
    expect(row.closeFee).toBe(800000000000000n);
    expect(row.leverage).toBe(5000000000000000000n);
    expect(row.cva).toBe(1000000000000000000n);
    expect(row.lf).toBe(500000000000000000n);
    expect(row.initialCva).toBe(1200000000000000000n);
    expect(row.initialLf).toBe(600000000000000000n);
    expect(row.initialPartyAmm).toBe(4200000000000000000n);
    expect(row.timestampSendQuote).toBe(1781990000);
    expect(row.timestampOpenPosition).toBe(1781990004);
    expect(row.subAccountOwner).toBe(getAddress(OWNER));
    expect(row.sendQuoteTransaction).toBe("0xopen");
    // Undecoded and in subgraph order: decoding the open fees is the consumer's choice.
    expect(row.openPositionMetadata).toEqual(['{"solverFees":[["STATIC_SOLVER_FEE","10"]]}', null]);
  });

  it("keeps unindexed optional fields null rather than zero", () => {
    const row = toQuoteHistoryRow(
      makeRow({
        quote: {
          closedPrice: null,
          initialOpenedPrice: null,
          marketPrice: null,
          leverage: null,
          cva: null,
          lf: null,
          initialPartyAmm: null,
          timestampSendQuote: null,
          timestampOpenPosition: null,
          sendQuoteEvents: [],
          openPositionEvents: [],
        },
      }),
    );

    expect(row.closedPrice).toBeNull();
    expect(row.initialOpenedPrice).toBeNull();
    expect(row.marketPrice).toBeNull();
    expect(row.leverage).toBeNull();
    expect(row.cva).toBeNull();
    expect(row.lf).toBeNull();
    expect(row.initialPartyAmm).toBeNull();
    expect(row.timestampSendQuote).toBeNull();
    expect(row.timestampOpenPosition).toBeNull();
    expect(row.sendQuoteTransaction).toBeNull();
    expect(row.openPositionMetadata).toEqual([]);
  });

  it("decodes the event's solver fees off the metadata snapshot", () => {
    const row = toQuoteHistoryRow(
      makeRow({
        type: "FILL_CLOSE",
        metadata: JSON.stringify({
          amount: "300970508000000000000",
          closePrice: "7299745129845081",
          solverFees: [
            ["SOLVER_FEE", "659102399999999"],
            ["STATIC_SOLVER_FEE", "100000000000000000"],
          ],
        }),
      }),
    );

    expect(row.solverFee).toBe(659102399999999n);
    expect(row.staticSolverFee).toBe(100000000000000000n);
    expect(row.totalSolverFee).toBe(100659102399999999n);
  });

  it("leaves the solver fees null on an event that records none", () => {
    // Liquidation and ADL events, and deployments indexed before the fee was
    // recorded, carry no `solverFees` key at all.
    const row = toQuoteHistoryRow(
      makeRow({ type: "LIQUIDATE_PARTY_A", metadata: JSON.stringify({ amount: "1", closePrice: "2" }) }),
    );

    expect(row.solverFee).toBeNull();
    expect(row.staticSolverFee).toBeNull();
    expect(row.totalSolverFee).toBeNull();
  });
});
