import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Read the analytics subgraph's `Quote` entities, as indexed. Every filter
 * (`quoteId_in`, `source`, `partyA_in`, the `id_gt` cursor) travels in the
 * action-built `$where`, present only when the caller passes it.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const SubgraphQuotesDocument = graphql(`
  query SubgraphQuotes(
    $where: Quote_filter!
    $first: Int!
    $skip: Int!
    $orderBy: Quote_orderBy!
    $orderDirection: OrderDirection!
  ) {
    quotes(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection, where: $where) {
      id
      source
      quoteId
      quoteStatus
      partyA
      partyB
      symbolId
      symbol
      positionType
      quantity
      fillAmount
      closedAmount
      openedPrice
      accumulatedPaidFunding
      lastFundingPaymentTimestamp
      userPaidFunding
      userReceivedFunding
      timestampSendQuote
      timestampOpenPosition
      timestampFullyClose
      timestamp
      blockNumber
    }
  }
`);
