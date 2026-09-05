import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Batched sibling of `QuoteEventsForQuoteByTypeDocument`: read every `QuoteEvent`
 * of the requested types for **many** quote ids in one round-trip, merged and
 * sorted server-side by `timestamp`. Filters on the protocol-level `quoteId`
 * scalar via `quoteId_in` — the same batching `QuotesFundingDocument` uses — so
 * callers never need the diamond address.
 *
 * The field selection is deliberately identical to the single-quote document so
 * `toQuoteEventRow` decodes both without change.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const QuoteEventsForQuotesByTypeDocument = graphql(`
  query QuoteEventsForQuotesByType(
    $quoteIds: [BigInt!]!
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
      where: { quoteId_in: $quoteIds, type_in: $typeIn }
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
