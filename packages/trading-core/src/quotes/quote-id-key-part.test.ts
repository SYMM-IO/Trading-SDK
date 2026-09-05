import { describe, expect, it } from "vitest";
import { toQuoteIdKeyPart } from "./quote-id-key-part";

describe("toQuoteIdKeyPart", () => {
  it("stringifies the ids", () => {
    expect(toQuoteIdKeyPart([7334n, 7335n])).toEqual(["7334", "7335"]);
  });

  it("sorts ascending so id order does not fragment the cache", () => {
    expect(toQuoteIdKeyPart([7335n, 7334n])).toEqual(toQuoteIdKeyPart([7334n, 7335n]));
  });

  it("sorts numerically, not lexicographically", () => {
    expect(toQuoteIdKeyPart([10n, 9n, 100n])).toEqual(["9", "10", "100"]);
  });

  it("sorts a copy so the caller's array is never mutated", () => {
    const quoteIds = [7335n, 7334n];

    expect(toQuoteIdKeyPart(quoteIds)).toEqual(["7334", "7335"]);
    expect(quoteIds).toEqual([7335n, 7334n]);
  });

  it("returns an empty list for no ids", () => {
    expect(toQuoteIdKeyPart([])).toEqual([]);
  });
});
