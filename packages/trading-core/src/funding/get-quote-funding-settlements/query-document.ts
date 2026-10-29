import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Read `QuoteFundingSettlement` entities — one per funding settlement on a quote.
 * Every filter (`quoteId_in`, `source`, `partyA_in`, the `timestamp` range, the
 * `id_gt` cursor) travels in the action-built `$where`, present only when the
 * caller passes it.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const QuoteFundingSettlementsDocument = graphql(`
  query QuoteFundingSettlements(
    $where: QuoteFundingSettlement_filter!
    $first: Int!
    $skip: Int!
    $orderBy: QuoteFundingSettlement_orderBy!
    $orderDirection: OrderDirection!
  ) {
    quoteFundingSettlements(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: $where
    ) {
      id
      source
      quoteId
      partyA
      partyB
      symbolId
      positionType
      trigger
      openAmount
      signedAmount
      paidByPartyA
      receivedByPartyA
      previousAccumulatedPaidFunding
      newAccumulatedPaidFunding
      fundingDeltaPerUnit
      previousLastFundingPaymentTimestamp
      newLastFundingPaymentTimestamp
      previousPaidThroughEpoch
      newPaidThroughEpoch
      balanceChanged
      timestamp
      blockNumber
      transaction
    }
  }
`);
