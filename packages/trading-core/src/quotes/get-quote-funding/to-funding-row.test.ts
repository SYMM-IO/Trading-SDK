import { describe, expect, it } from "vitest";
import { toQuoteFundingRow, type RawQuoteFundingRow } from "./to-funding-row";

function makeRow(overrides?: Partial<RawQuoteFundingRow>): RawQuoteFundingRow {
  return {
    quoteId: "7334",
    userPaidFunding: "3000000000000000000",
    userReceivedFunding: "1000000000000000000",
    ...overrides,
  };
}

describe("toQuoteFundingRow", () => {
  it("parses the wei strings and computes a negative netReceived when paid exceeds received", () => {
    const row = toQuoteFundingRow(makeRow());

    expect(row).toEqual({
      quoteId: 7334n,
      paid: 3000000000000000000n,
      received: 1000000000000000000n,
      netReceived: -2000000000000000000n,
    });
  });

  it("computes a positive netReceived when the user received more than they paid", () => {
    const row = toQuoteFundingRow(
      makeRow({ userPaidFunding: "1000000000000000000", userReceivedFunding: "3000000000000000000" }),
    );

    expect(row.netReceived).toBe(2000000000000000000n);
  });

  it("defaults null funding fields to 0n", () => {
    const row = toQuoteFundingRow(makeRow({ userPaidFunding: null, userReceivedFunding: null }));

    expect(row).toEqual({ quoteId: 7334n, paid: 0n, received: 0n, netReceived: 0n });
  });

  it("handles a null on only one side", () => {
    const row = toQuoteFundingRow(makeRow({ userReceivedFunding: null }));

    expect(row.paid).toBe(3000000000000000000n);
    expect(row.received).toBe(0n);
    expect(row.netReceived).toBe(-3000000000000000000n);
  });

  it('treats an explicit "0" string as zero without throwing', () => {
    const row = toQuoteFundingRow(makeRow({ userPaidFunding: "0", userReceivedFunding: "0" }));

    expect(row.paid).toBe(0n);
    expect(row.received).toBe(0n);
    expect(row.netReceived).toBe(0n);
  });
});
