import { describe, expect, it } from "vitest";
import type { PoolQuotesQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { toPoolQuote } from "./to-pool-quote";

type RawPoolQuoteRow = PoolQuotesQuery["quotes"][number];

/** A live-shaped `quotes` row, trimmed to what the pool document selects. */
function makeRow(overrides: Partial<RawPoolQuoteRow> = {}): RawPoolQuoteRow {
  return {
    id: "8232-0x57331038c21982116ee9b0906e4a5c5cb52dce2e",
    quoteId: "8232",
    quoteStatus: 4,
    positionType: 0,
    orderTypeOpen: 1,
    symbol: "SYMM",
    symbolId: "149",
    partyA: "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a",
    partyB: "0x1111111111111111111111111111111111111111",
    quantity: "8371837985641000000000000",
    closedAmount: "1000000000000000000",
    quantityToClose: "0",
    openedPrice: "8252058245467028",
    requestedOpenPrice: "8300000000000000",
    averageClosedPrice: "8400000000000000",
    closePrice: "0",
    initialOpenedPrice: "8252058245467028",
    liquidateAmount: null,
    liquidatePrice: null,
    timestamp: "1782000000",
    blockNumber: "13456789",
    ...overrides,
  };
}

describe("toPoolQuote", () => {
  it("keeps the subgraph's big decimal strings as exact bigints", () => {
    expect(toPoolQuote(makeRow())).toEqual({
      id: "8232-0x57331038c21982116ee9b0906e4a5c5cb52dce2e",
      quoteId: 8232n,
      quoteStatus: 4,
      positionType: 0,
      orderTypeOpen: 1,
      symbol: "SYMM",
      symbolId: 149,
      partyA: "0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a",
      partyB: "0x1111111111111111111111111111111111111111",
      quantity: 8371837985641000000000000n,
      closedAmount: 1000000000000000000n,
      quantityToClose: 0n,
      openedPrice: 8252058245467028n,
      requestedOpenPrice: 8300000000000000n,
      averageClosedPrice: 8400000000000000n,
      closePrice: 0n,
      initialOpenedPrice: 8252058245467028n,
      liquidateAmount: null,
      liquidatePrice: null,
      timestamp: 1782000000,
      blockNumber: 13456789n,
    });
  });

  it("narrows symbolId to a number, because it indexes the solver's market registry", () => {
    const quote = toPoolQuote(makeRow({ symbolId: "149" }));

    expect(quote.symbolId).toBe(149);
    expect(typeof quote.symbolId).toBe("number");
  });

  it("keeps an absent optional field null instead of collapsing it to zero", () => {
    const quote = toPoolQuote(makeRow({ quantity: null, closedAmount: "", openedPrice: undefined }));

    expect(quote.quantity).toBeNull();
    expect(quote.closedAmount).toBeNull();
    expect(quote.openedPrice).toBeNull();
    expect(quote.symbolId).toBe(149);
  });

  it("reads an unlisted quote's absent symbolId as null rather than NaN", () => {
    expect(toPoolQuote(makeRow({ symbolId: null })).symbolId).toBeNull();
  });

  it("defaults the required identity and block fields to zero rather than throwing", () => {
    const quote = toPoolQuote(makeRow({ quoteId: "not-a-number", timestamp: "1.5", blockNumber: "" }));

    expect(quote.quoteId).toBe(0n);
    expect(quote.timestamp).toBe(0);
    expect(quote.blockNumber).toBe(0n);
  });

  it("survives one malformed row without taking down the page", () => {
    const rows = [makeRow(), makeRow({ id: "bad", quantity: "1e18" })];

    expect(() => rows.map(toPoolQuote)).not.toThrow();
    expect(rows.map(toPoolQuote)[1]!.quantity).toBeNull();
  });
});
