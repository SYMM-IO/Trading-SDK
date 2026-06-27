import type { QuotesFundingQuery } from "../../symmio-subgraph/types/generated/graphql";
import type { QuoteFundingData } from "./types";

/** A single `quotes` row as returned by the funding query. */
export type RawQuoteFundingRow = QuotesFundingQuery["quotes"][number];

/** Parse a wei string to `bigint`, defaulting null/undefined to `0n`. */
function toBigInt(value: string | null | undefined): bigint {
  return value ? BigInt(value) : 0n;
}

/**
 * Build a {@link QuoteFundingData} from one raw subgraph `quotes` row. `net` is
 * `paid − received`, so a positive value means net-paid.
 */
export function toQuoteFundingRow(row: RawQuoteFundingRow): QuoteFundingData {
  const paid = toBigInt(row.userPaidFunding);
  const received = toBigInt(row.userReceivedFunding);
  return {
    quoteId: toBigInt(row.quoteId),
    paid,
    received,
    net: paid - received,
  };
}
