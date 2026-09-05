import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * A pool's own quote book, from the analytics subgraph.
 *
 * Scoped by `symbolId` **and** `source` — the SYMMIO diamond the quotes were
 * opened against — and filtered to the caller's `quoteStatus_in` set. There is
 * deliberately **no** `partyA` / `partyB` clause: a pool's book is every
 * trader's quotes on that market, not one account's, which is what makes this a
 * different read from the account-scoped `getQuoteHistory`.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const PoolQuotesDocument = graphql(`
  query PoolQuotes(
    $symbolId: BigInt!
    $source: Bytes!
    $quoteStatuses: [Int!]!
    $first: Int!
    $skip: Int!
    $orderDirection: OrderDirection!
  ) {
    quotes(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { symbolId: $symbolId, source: $source, quoteStatus_in: $quoteStatuses }
    ) {
      id
      quoteId
      quoteStatus
      positionType
      orderTypeOpen
      symbol
      symbolId
      partyA
      partyB
      quantity
      closedAmount
      quantityToClose
      openedPrice
      requestedOpenPrice
      averageClosedPrice
      closePrice
      initialOpenedPrice
      liquidateAmount
      liquidatePrice
      timestamp
      blockNumber
    }
  }
`);
