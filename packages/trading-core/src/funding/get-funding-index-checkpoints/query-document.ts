import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Read `FundingIndexCheckpoint` entities — the funding-rate index of one market
 * and PartyB at a point in time. Every filter (`source`, `symbolId_in`,
 * `partyB_in`, the `timestamp` range, the `id_gt` cursor) travels in the
 * action-built `$where`, present only when the caller passes it.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const FundingIndexCheckpointsDocument = graphql(`
  query FundingIndexCheckpoints(
    $where: FundingIndexCheckpoint_filter!
    $first: Int!
    $skip: Int!
    $orderBy: FundingIndexCheckpoint_orderBy!
    $orderDirection: OrderDirection!
  ) {
    fundingIndexCheckpoints(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: $where
    ) {
      id
      source
      symbolId
      partyB
      eventType
      rawLongRate
      rawShortRate
      marketPrice
      currentLongRate
      currentShortRate
      accumulatedLongRate
      accumulatedShortRate
      epochDuration
      lastUpdatedEpoch
      startEpoch
      startEpochTimestamp
      snapshotLongFee
      snapshotShortFee
      timestamp
      blockNumber
      transaction
    }
  }
`);
