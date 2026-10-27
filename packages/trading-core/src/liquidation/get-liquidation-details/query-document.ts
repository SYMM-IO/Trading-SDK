import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Read `LiquidationDetail` entities — one per PartyA liquidation, with the locked
 * and paid CVA/LF and the per-PartyB settlement amounts. Every filter (`source`,
 * `partyA_in`, the `liquidationTimestamp` range, the `id_gt` cursor) travels in
 * the action-built `$where`, present only when the caller passes it.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const LiquidationDetailsDocument = graphql(`
  query LiquidationDetails(
    $where: LiquidationDetail_filter!
    $first: Int!
    $skip: Int!
    $orderBy: LiquidationDetail_orderBy!
    $orderDirection: OrderDirection!
  ) {
    liquidationDetails(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection, where: $where) {
      id
      source
      partyA
      liquidationId
      liquidationType
      liquidationTimestamp
      timestamp
      lockedCva
      lockedLf
      lockedPartyAmm
      paidCva
      paidLf
      upnl
      deficit
      liquidationFee
      settled
      fullyLiquidated
      settlementExpectedAmounts
      settlementActualAmounts
    }
  }
`);
