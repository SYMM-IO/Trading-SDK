import { QuoteStatus } from "../../symmio-contracts/symmio/types";
import { QuoteCloseEventType, QuoteCloseType } from "./types";

/** All terminal close/liquidation event types, in display order. */
const ALL_CLOSE_EVENT_TYPES: readonly QuoteCloseEventType[] = [
  QuoteCloseEventType.FillClose,
  QuoteCloseEventType.ForceClose,
  QuoteCloseEventType.EmergencyClose,
  QuoteCloseEventType.AdlClose,
  QuoteCloseEventType.LiquidatePartyA,
  QuoteCloseEventType.LiquidatePartyB,
  QuoteCloseEventType.LiquidateClearingHouse,
];

/**
 * Map a {@link QuoteCloseType} filter to the subgraph `QuoteEvent.type` values
 * it selects (the `type_in` clause of the history query).
 */
export const closeTypeToEventTypes: Record<QuoteCloseType, readonly QuoteCloseEventType[]> = {
  [QuoteCloseType.All]: ALL_CLOSE_EVENT_TYPES,
  [QuoteCloseType.Closed]: [QuoteCloseEventType.FillClose],
  [QuoteCloseType.ForceClosed]: [QuoteCloseEventType.ForceClose],
  [QuoteCloseType.EmergencyClosed]: [QuoteCloseEventType.EmergencyClose],
  [QuoteCloseType.AdlClosed]: [QuoteCloseEventType.AdlClose],
  [QuoteCloseType.Liquidated]: [
    QuoteCloseEventType.LiquidatePartyA,
    QuoteCloseEventType.LiquidatePartyB,
    QuoteCloseEventType.LiquidateClearingHouse,
  ],
};

/**
 * Map a subgraph `QuoteEvent.type` value to the {@link QuoteCloseType} category
 * it belongs to. Inverse of {@link closeTypeToEventTypes}; useful for tagging a
 * row's close type from its event.
 */
export const eventTypeToCloseType: Record<QuoteCloseEventType, QuoteCloseType> = {
  [QuoteCloseEventType.FillClose]: QuoteCloseType.Closed,
  [QuoteCloseEventType.ForceClose]: QuoteCloseType.ForceClosed,
  [QuoteCloseEventType.EmergencyClose]: QuoteCloseType.EmergencyClosed,
  [QuoteCloseEventType.AdlClose]: QuoteCloseType.AdlClosed,
  [QuoteCloseEventType.LiquidatePartyA]: QuoteCloseType.Liquidated,
  [QuoteCloseEventType.LiquidatePartyB]: QuoteCloseType.Liquidated,
  [QuoteCloseEventType.LiquidateClearingHouse]: QuoteCloseType.Liquidated,
};

/**
 * Lifecycle {@link QuoteStatus} a close/liquidation event forces onto its row.
 *
 * The nested `quote` reflects current mutable state, so the row's status is
 * derived from the event type instead: any close → `CLOSED`, any liquidation →
 * `LIQUIDATED`.
 */
export const eventTypeToQuoteStatus: Record<QuoteCloseEventType, QuoteStatus> = {
  [QuoteCloseEventType.FillClose]: QuoteStatus.CLOSED,
  [QuoteCloseEventType.ForceClose]: QuoteStatus.CLOSED,
  [QuoteCloseEventType.EmergencyClose]: QuoteStatus.CLOSED,
  [QuoteCloseEventType.AdlClose]: QuoteStatus.CLOSED,
  [QuoteCloseEventType.LiquidatePartyA]: QuoteStatus.LIQUIDATED,
  [QuoteCloseEventType.LiquidatePartyB]: QuoteStatus.LIQUIDATED,
  [QuoteCloseEventType.LiquidateClearingHouse]: QuoteStatus.LIQUIDATED,
};

/** The liquidation event types (rows that populate `liquidateAmount`/`liquidatePrice`). */
export const LIQUIDATION_EVENT_TYPES: ReadonlySet<QuoteCloseEventType> = new Set([
  QuoteCloseEventType.LiquidatePartyA,
  QuoteCloseEventType.LiquidatePartyB,
  QuoteCloseEventType.LiquidateClearingHouse,
]);
