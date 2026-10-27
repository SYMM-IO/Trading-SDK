import type { PositionType } from "../../symmio-contracts/symmio/types";
import { toAddress, toBigIntOrNull, toBigIntOrZero, toHex } from "../../symmio-subgraph/subgraph-decode";
import type { QuoteFundingSettlementsQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import type { QuoteFundingSettlementRow } from "./types";

/** A single `quoteFundingSettlements` entity as returned by the subgraph. */
export type RawQuoteFundingSettlementRow = QuoteFundingSettlementsQuery["quoteFundingSettlements"][number];

/**
 * Decode one raw `quoteFundingSettlements` entity into a {@link QuoteFundingSettlementRow}.
 *
 * @param row - The raw entity.
 * @returns The decoded row.
 */
export function toQuoteFundingSettlementRow(row: RawQuoteFundingSettlementRow): QuoteFundingSettlementRow {
  return {
    id: row.id,
    source: toAddress(row.source),
    quoteId: toBigIntOrZero(row.quoteId),
    partyA: toAddress(row.partyA),
    partyB: toAddress(row.partyB),
    symbolId: Number(row.symbolId),
    positionType: row.positionType as PositionType,
    trigger: row.trigger,
    openAmount: toBigIntOrZero(row.openAmount),
    signedAmount: toBigIntOrZero(row.signedAmount),
    paidByPartyA: toBigIntOrZero(row.paidByPartyA),
    receivedByPartyA: toBigIntOrZero(row.receivedByPartyA),
    previousAccumulatedPaidFunding: toBigIntOrZero(row.previousAccumulatedPaidFunding),
    newAccumulatedPaidFunding: toBigIntOrZero(row.newAccumulatedPaidFunding),
    fundingDeltaPerUnit: toBigIntOrZero(row.fundingDeltaPerUnit),
    previousLastFundingPaymentTimestamp: Number(row.previousLastFundingPaymentTimestamp),
    newLastFundingPaymentTimestamp: Number(row.newLastFundingPaymentTimestamp),
    previousPaidThroughEpoch: toBigIntOrNull(row.previousPaidThroughEpoch),
    newPaidThroughEpoch: toBigIntOrNull(row.newPaidThroughEpoch),
    balanceChanged: row.balanceChanged,
    timestamp: Number(row.timestamp),
    blockNumber: toBigIntOrZero(row.blockNumber),
    transaction: toHex(row.transaction),
  };
}
