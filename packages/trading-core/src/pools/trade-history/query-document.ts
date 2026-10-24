import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * A pool's realized trade history, from the analytics subgraph.
 *
 * Reads the immutable `quoteEvents` collection rather than `quotes`, so a quote
 * closed across several partial closes yields one row per close — each with the
 * frozen `metadata` snapshot of that close, which is what makes the rows
 * distinct. Scoped to the pool by the quote's `symbolId` and `source`, with no
 * account filter: this is the whole pool's history.
 *
 * The selection matches `QuoteEventsForHistoryDocument` field for field, because
 * both decode through `toQuoteHistoryRow` into the same `QuoteHistoryRow`.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const PoolQuoteEventsDocument = graphql(`
  query PoolQuoteEvents(
    $typeIn: [String!]!
    $symbolId: BigInt!
    $source: Bytes!
    $first: Int!
    $skip: Int!
    $orderDirection: OrderDirection!
  ) {
    quoteEvents(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { type_in: $typeIn, quote_: { symbolId: $symbolId, source: $source } }
    ) {
      id
      type
      metadata
      timestamp
      quoteId
      blockNumber
      transaction
      source
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
          owner
        }
        quantity
        openedPrice
        initialOpenedPrice
        requestedOpenPrice
        marketPrice
        averageClosedPrice
        closePrice
        closedPrice
        closedAmount
        quantityToClose
        liquidateAmount
        liquidatePrice
        tradingFee
        closeFee
        leverage
        cva
        lf
        initialCva
        initialLf
        initialPartyAmm
        timestampSendQuote
        timestampOpenPosition
        sendQuoteEvents: quoteEvents(where: { type: "SEND_QUOTE" }, first: 1) {
          transaction
        }
        openPositionEvents: quoteEvents(where: { type: "OPEN_POSITION" }, first: 1000) {
          metadata
        }
      }
    }
  }
`);
