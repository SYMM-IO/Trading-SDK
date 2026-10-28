import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Read `QuoteEvent`s for one quote id, paginated and sorted by `timestamp`.
 * Filter by the protocol-level `quoteId` scalar so callers never need the diamond
 * address. The action builds `$where`: `quoteId` always, `type_in` and `source`
 * only when passed. Caller decodes `metadata` per row.
 */
export const QuoteEventsForQuoteByTypeDocument = graphql(`
  query QuoteEventsForQuoteByType(
    $where: QuoteEvent_filter!
    $first: Int!
    $skip: Int!
    $orderDirection: OrderDirection!
  ) {
    quoteEvents(first: $first, skip: $skip, orderBy: timestamp, orderDirection: $orderDirection, where: $where) {
      id
      type
      metadata
      timestamp
      blockNumber
      transaction
      quoteId
    }
  }
`);
