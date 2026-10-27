import { toAddress, toBigIntOrNull, toBigIntOrZero, toNumberOrNull } from "../../symmio-subgraph/subgraph-decode";
import type { LiquidationDetailsQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import type { LiquidationDetailRow } from "./types";

/** A single `liquidationDetails` entity as returned by the subgraph. */
export type RawLiquidationDetailRow = LiquidationDetailsQuery["liquidationDetails"][number];

function toBigIntList(values: readonly string[] | null): bigint[] | null {
  return values === null ? null : values.map((value) => BigInt(value));
}

/**
 * Decode one raw `liquidationDetails` entity into a {@link LiquidationDetailRow}.
 *
 * @param row - The raw entity.
 * @returns The decoded row.
 */
export function toLiquidationDetailRow(row: RawLiquidationDetailRow): LiquidationDetailRow {
  return {
    id: row.id,
    source: toAddress(row.source),
    partyA: toAddress(row.partyA),
    liquidationId: toBigIntOrZero(row.liquidationId),
    liquidationType: row.liquidationType,
    liquidationTimestamp: Number(row.liquidationTimestamp),
    timestamp: toNumberOrNull(row.timestamp),
    lockedCva: toBigIntOrNull(row.lockedCva),
    lockedLf: toBigIntOrNull(row.lockedLf),
    lockedPartyAmm: toBigIntOrNull(row.lockedPartyAmm),
    paidCva: toBigIntOrNull(row.paidCva),
    paidLf: toBigIntOrNull(row.paidLf),
    upnl: toBigIntOrZero(row.upnl),
    deficit: toBigIntOrZero(row.deficit),
    liquidationFee: toBigIntOrZero(row.liquidationFee),
    settled: row.settled,
    fullyLiquidated: row.fullyLiquidated,
    settlementExpectedAmounts: toBigIntList(row.settlementExpectedAmounts),
    settlementActualAmounts: toBigIntList(row.settlementActualAmounts),
  };
}
