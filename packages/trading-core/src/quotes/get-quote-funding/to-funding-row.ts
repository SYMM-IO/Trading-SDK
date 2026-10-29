import { toBigIntOrZero } from "../../symmio-subgraph/subgraph-decode";
import type { QuotesFundingQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import type { QuoteFundingData } from "./types";

/** A single `quotes` row as returned by the funding query. */
export type RawQuoteFundingRow = QuotesFundingQuery["quotes"][number];

/**
 * Build a {@link QuoteFundingData} from one raw subgraph `quotes` row.
 * `netReceived` is `received − paid`, so a positive value means the position
 * earned funding.
 */
export function toQuoteFundingRow(row: RawQuoteFundingRow): QuoteFundingData {
  const paid = toBigIntOrZero(row.userPaidFunding);
  const received = toBigIntOrZero(row.userReceivedFunding);
  return {
    quoteId: toBigIntOrZero(row.quoteId),
    paid,
    received,
    netReceived: received - paid,
  };
}
