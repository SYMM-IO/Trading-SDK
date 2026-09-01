import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * History query over the immutable `quoteEvents` collection (SYMMIO subgraphs
 * v0.8.6+). Each row is one close/liquidation event with a frozen `metadata`
 * snapshot plus the (mutable) `quote` it belongs to — the snapshot is what makes
 * multiple partial-close rows of the same quote distinct.
 *
 * Filtered server-side by event `type_in` (close-type), `timestamp` range, and
 * the quote's `subAccount_in`. Sorted by event `timestamp` (the row's close
 * time). The document compiles to a typed query string via graphql-codegen.
 */
export const QuoteEventsForHistoryDocument = graphql(`
  query QuoteEventsForHistory(
    $typeIn: [String!]!
    $subAccounts: [String!]!
    $first: Int!
    $skip: Int!
    $orderDirection: OrderDirection!
    $startDate: BigInt!
    $endDate: BigInt!
  ) {
    quoteEvents(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: $orderDirection
      where: {
        type_in: $typeIn
        timestamp_gte: $startDate
        timestamp_lte: $endDate
        quote_: { subAccount_in: $subAccounts }
      }
    ) {
      id
      type
      metadata
      timestamp
      quoteId
      blockNumber
      transaction
      quote {
        quoteId
        quoteStatus
        positionType
        orderTypeOpen
        symbol
        symbolId
        partyA
        partyB
        subAccount {
          id
        }
        quantity
        openedPrice
        requestedOpenPrice
        averageClosedPrice
        closePrice
        closedAmount
        quantityToClose
        liquidateAmount
        liquidatePrice
      }
    }
  }
`);
