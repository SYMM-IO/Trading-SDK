import { QuoteStatus } from "../../symmio-contracts/symmio/types";
import type { UnifiedQuote } from "../unified-quote";
import { minRemainingQuantityOf } from "./min-remaining-quantity";
import type { GroupCloseCandidate } from "./types";

/**
 * Build {@link GroupCloseCandidate}s for {@link planGroupClose} from a group's
 * child quotes.
 *
 * Only children that can actually receive a close order qualify: anchored
 * on-chain (`quoteId` known), status `OPENED` (a `CLOSE_PENDING` child already
 * has a close in flight), and open size left. Each candidate carries its
 * contract min-remainder (see {@link minRemainingQuantityOf}).
 *
 * @param quotes - The group's child quotes.
 * @param minAcceptableQuoteValue - The symbol's `minAcceptableQuoteValue`, wei.
 * @returns Candidates for the planner, in the input order.
 */
export function toGroupCloseCandidates(
  quotes: readonly UnifiedQuote[],
  minAcceptableQuoteValue: bigint,
): GroupCloseCandidate[] {
  const candidates: GroupCloseCandidate[] = [];
  for (const quote of quotes) {
    if (quote.quoteId === undefined) continue;
    if (quote.quoteStatus !== QuoteStatus.OPENED) continue;
    if (quote.openQuantity <= 0n) continue;
    candidates.push({
      key: quote.key,
      openQuantity: quote.openQuantity,
      minRemainingQuantity: minRemainingQuantityOf(quote, minAcceptableQuoteValue),
    });
  }
  return candidates;
}
