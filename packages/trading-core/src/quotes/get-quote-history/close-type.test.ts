import { describe, expect, it } from "vitest";
import { QuoteStatus } from "../../symmio-contracts/symmio/types";
import { closeTypeToEventTypes, eventTypeToCloseType, eventTypeToQuoteStatus } from "./close-type";
import { QuoteCloseEventType, QuoteCloseType } from "./types";

describe("close-type maps", () => {
  it("expands `All` to every terminal event type", () => {
    expect(closeTypeToEventTypes[QuoteCloseType.All]).toHaveLength(7);
  });

  it("maps `Liquidated` to all three liquidation events", () => {
    expect(closeTypeToEventTypes[QuoteCloseType.Liquidated]).toEqual([
      QuoteCloseEventType.LiquidatePartyA,
      QuoteCloseEventType.LiquidatePartyB,
      QuoteCloseEventType.LiquidateClearingHouse,
    ]);
  });

  it("maps single-event filters to one event type", () => {
    expect(closeTypeToEventTypes[QuoteCloseType.Closed]).toEqual([QuoteCloseEventType.FillClose]);
    expect(closeTypeToEventTypes[QuoteCloseType.ForceClosed]).toEqual([QuoteCloseEventType.ForceClose]);
    expect(closeTypeToEventTypes[QuoteCloseType.AdlClosed]).toEqual([QuoteCloseEventType.AdlClose]);
  });

  it("inverts event type back to its close-type category", () => {
    expect(eventTypeToCloseType[QuoteCloseEventType.FillClose]).toBe(QuoteCloseType.Closed);
    expect(eventTypeToCloseType[QuoteCloseEventType.LiquidatePartyB]).toBe(QuoteCloseType.Liquidated);
  });

  it("forces CLOSED for closes and LIQUIDATED for liquidations", () => {
    expect(eventTypeToQuoteStatus[QuoteCloseEventType.FillClose]).toBe(QuoteStatus.CLOSED);
    expect(eventTypeToQuoteStatus[QuoteCloseEventType.EmergencyClose]).toBe(QuoteStatus.CLOSED);
    expect(eventTypeToQuoteStatus[QuoteCloseEventType.LiquidateClearingHouse]).toBe(QuoteStatus.LIQUIDATED);
  });
});
