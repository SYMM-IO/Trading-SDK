import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Batched sibling of `QuoteEventsForQuoteByTypeDocument`: read `QuoteEvent`s for
 * **many** quote ids in one round-trip, merged and sorted server-side by
 * `timestamp`. Filters on the protocol-level `quoteId` scalar via `quoteId_in` —
 * the same batching `QuotesFundingDocument` uses — so callers never need the
 * diamond address. The action builds `$where`: `quoteId_in` always, `type_in`
 * and `source` only when passed.
 *
 * The field selection is deliberately identical to the single-quote document so
 * `toQuoteEventRow` decodes both without change.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const QuoteEventsForQuotesByTypeDocument = graphql(`
  query QuoteEventsForQuotesByType(
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
