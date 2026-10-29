import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * History query over the immutable `quoteEvents` collection (SYMMIO subgraphs
 * v0.8.6+). Each row is one close/liquidation event with a frozen `metadata`
 * snapshot plus the (mutable) `quote` it belongs to — the snapshot is what makes
 * multiple partial-close rows of the same quote distinct.
 *
 * Every filter travels in one `$where` object that the action builds, so a
 * filter the caller omits is absent rather than sent as `null` (graph-node
 * rejects a null `_in` filter). The action always sets the event `type_in`
 * (close-type) and `timestamp` range; account (`subAccount_in` / `partyA_in`),
 * deployment (`source`) and market (`symbolId_in`) filters go on `quote_` only
 * when passed. Sorted by event `timestamp` (the row's close time).
 *
 * Alongside the quote's own fields it reads two relations: the `SEND_QUOTE`
 * event's transaction (the open transaction), and the raw `metadata` of the
 * quote's `OPEN_POSITION` events, left undecoded for the consumer. The document
 * compiles to a typed query string via graphql-codegen.
 */
export const QuoteEventsForHistoryDocument = graphql(`
  query QuoteEventsForHistory($where: QuoteEvent_filter!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!) {
    quoteEvents(first: $first, skip: $skip, orderBy: timestamp, orderDirection: $orderDirection, where: $where) {
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
