import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Read every `QuoteEvent` of the requested types for one quote id, paginated and
 * sorted by `timestamp`. Filter by the protocol-level `quoteId` scalar so callers
 * never need the diamond address. Caller decodes `metadata` per row.
 */
export const QuoteEventsForQuoteByTypeDocument = graphql(`
  query QuoteEventsForQuoteByType(
    $quoteId: BigInt!
    $typeIn: [String!]!
    $first: Int!
    $skip: Int!
    $orderDirection: OrderDirection!
  ) {
    quoteEvents(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { quoteId: $quoteId, type_in: $typeIn }
    ) {
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
