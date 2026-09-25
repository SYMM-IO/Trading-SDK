import { QuoteCloseEventType, QuoteCloseType } from "@symmio/trading-core";
import { theme } from "../../config/theme.js";

/** A short label + accent color for the terminal event that produced a row. */
export function closeEventMeta(event: QuoteCloseEventType): { label: string; color: string } {
  switch (event) {
    case QuoteCloseEventType.FillClose:
      return { label: "Closed", color: theme.muted };
    case QuoteCloseEventType.ForceClose:
      return { label: "Force close", color: theme.warning };
    case QuoteCloseEventType.EmergencyClose:
      return { label: "Emergency", color: theme.warning };
    case QuoteCloseEventType.AdlClose:
      return { label: "ADL close", color: theme.warning };
    /** All three liquidation variants collapse to one label, as on the web. */
    case QuoteCloseEventType.LiquidatePartyA:
    case QuoteCloseEventType.LiquidatePartyB:
    case QuoteCloseEventType.LiquidateClearingHouse:
      return { label: "Liquidated", color: theme.negative };
    default:
      return { label: String(event), color: theme.muted };
  }
}

/** The close-type filter cycled with `f`, in order. */
export const CLOSE_TYPE_FILTERS: readonly { value: QuoteCloseType; label: string }[] = [
  { value: QuoteCloseType.All, label: "All" },
  { value: QuoteCloseType.Closed, label: "Closed" },
  { value: QuoteCloseType.Liquidated, label: "Liquidated" },
  { value: QuoteCloseType.ForceClosed, label: "Force closed" },
  { value: QuoteCloseType.EmergencyClosed, label: "Emergency" },
  { value: QuoteCloseType.AdlClosed, label: "ADL" },
];
