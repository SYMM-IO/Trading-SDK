import { describe, expect, it } from "vitest";
import { QuoteStatus } from "../../symmio-contracts/symmio/types";
import { makeOptimisticQuote, makeUnifiedQuote } from "../unified-quote.test";
import { toGroupCloseCandidates } from "./to-close-candidates";

const ONE = 10n ** 18n;
const MAQV = 10n * ONE;

describe("toGroupCloseCandidates", () => {
  it("keeps only anchored OPENED children with open size", () => {
    const open = makeUnifiedQuote({ key: "onchain:1", quantity: 2n * ONE, closedAmount: 0n });
    const optimistic = makeOptimisticQuote({ key: "temp:2", tempQuoteId: 2 });
    const closing = makeUnifiedQuote({ key: "onchain:3", quoteStatus: QuoteStatus.CLOSE_PENDING });
    const drained = makeUnifiedQuote({ key: "onchain:4", quantity: 1n * ONE, closedAmount: 1n * ONE });

    const candidates = toGroupCloseCandidates([open, optimistic, closing, drained], MAQV);
    expect(candidates.map((candidate) => candidate.key)).toEqual(["onchain:1"]);
  });

  it("derives the remaining open size and the min remainder per candidate", () => {
    const fresh = makeUnifiedQuote({ key: "onchain:1", quantity: 2n * ONE, closedAmount: 0n });
    const partiallyClosed = makeUnifiedQuote({ key: "onchain:2", quantity: 2n * ONE, closedAmount: 1n * ONE });

    const [freshCandidate, partialCandidate] = toGroupCloseCandidates([fresh, partiallyClosed], MAQV);
    expect(freshCandidate).toMatchObject({ openQuantity: 2n * ONE });
    expect(partialCandidate).toMatchObject({ openQuantity: 1n * ONE });
    expect(partialCandidate!.minRemainingQuantity).toBeGreaterThan(0n);
  });
});
