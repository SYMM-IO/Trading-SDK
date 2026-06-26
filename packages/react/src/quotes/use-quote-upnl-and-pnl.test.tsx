import { PositionType, QuoteLifecycle, QuoteStatus, type UnifiedQuote } from "@theoldvarorg/core";
import { describe, expect, it } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useQuoteUpnlAndPnl } from "./use-quote-upnl-and-pnl";

const ONE = 10n ** 18n;

function makeQuote(overrides: Partial<UnifiedQuote> = {}): UnifiedQuote {
  return {
    key: "onchain:1",
    origin: "onchain",
    lifecycle: QuoteLifecycle.ONCHAIN,
    quoteId: 1n,
    positionType: PositionType.LONG,
    orderType: 1,
    quoteStatus: QuoteStatus.OPENED,
    requestedOpenPrice: 80_000_000_000_000_000n,
    openedPrice: 80_000_000_000_000_000n,
    quantity: 100n * ONE,
    closedAmount: 0n,
    lockedValues: { cva: 50n * ONE, lf: 25n * ONE, partyAmm: 25n * ONE, partyBmm: 0n },
    avgClosedPrice: 0n,
    partyA: "0x0000000000000000000000000000000000000000",
    partyB: "0x0000000000000000000000000000000000000000",
    symbolId: 1n,
    ...overrides,
  } as UnifiedQuote;
}

describe("useQuoteUpnlAndPnl", () => {
  it("returns zeros when no quote is provided", () => {
    const { result } = renderHookWithProviders(() => useQuoteUpnlAndPnl({ quote: undefined }));
    expect(result.current.upnl).toBe("0");
    expect(result.current.pnl).toBe("0");
    expect(result.current.isLoading).toBe(false);
  });

  it("returns realized pnl only while mark price has not arrived yet", () => {
    const { result } = renderHookWithProviders(() => useQuoteUpnlAndPnl({ quote: makeQuote() }));
    // No markets fetched in tests → marketName is null → mark price null.
    expect(result.current.markPrice).toBeNull();
    expect(result.current.upnl).toBe("0");
    expect(result.current.pnl).toBe("0");
    // leverage = 100 * 0.08 / (50 + 25 + 25 + 0) = 0.08 (no partyBmm here)
    expect(Number(result.current.leverage)).toBeCloseTo(0.08, 6);
  });
});
