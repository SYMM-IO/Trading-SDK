import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateOpenPlatformFee } from "../../quotes/fees/calculate-open-platform-fee";
import { QuoteCloseEventType } from "../../quotes/get-quote-history/types";
import { mockConfig } from "../../shared/test/mock-config";
import { getPoolTradeHistory } from "./get-pool-trade-history";

const ONE = 10n ** 18n;
const quote = {
  id: "quote",
  quoteId: "1",
  quoteStatus: 7,
  positionType: 0,
  orderTypeOpen: 1,
  symbol: "TOKEN",
  symbolId: "1",
  partyA: "0x1111111111111111111111111111111111111111",
  partyB: null,
  quantity: String(2n * ONE),
  openedPrice: String(100n * ONE),
  initialOpenedPrice: String(100n * ONE),
  averageClosedPrice: String(110n * ONE),
  closedAmount: String(2n * ONE),
  quantityToClose: "0",
  liquidateAmount: null,
  liquidatePrice: null,
  tradingFee: String(ONE / 1000n),
  closeFee: String(ONE / 500n),
  timestamp: "100",
  blockNumber: "1",
};
function event(id: string, amount: bigint, price: bigint, type = QuoteCloseEventType.FillClose) {
  return {
    id,
    type,
    quoteId: "1",
    timestamp: id === "first" ? "100" : "200",
    blockNumber: "1",
    metadata: JSON.stringify({ amount: String(amount), closePrice: String(price) }),
    quote,
  };
}
async function read(events: unknown[]) {
  vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { quoteEvents: events } } });
  return getPoolTradeHistory(mockConfig().config, { symbolId: 1 });
}
describe("pool history event metrics", () => {
  it("falls back to full quantity when close size is unavailable", async () => {
    const { rows } = await read([
      {
        ...event("fallback", ONE, ONE),
        metadata: "{}",
        quote: { ...quote, closedAmount: null, initialOpenedPrice: "0" },
      },
    ]);
    expect(rows[0]).toMatchObject({
      closeQuantity: 2n * ONE,
      openFee: ONE / 5n,
      closeFee: (44n * ONE) / 100n,
      platformFee: (64n * ONE) / 100n,
    });
  });
  it("does not price a liquidation from an earlier close or fabricate unknown fees", async () => {
    const { rows } = await read([
      {
        ...event("unknown", ONE, ONE, QuoteCloseEventType.LiquidatePartyA),
        metadata: "{}",
        quote: { ...quote, liquidateAmount: String(ONE), liquidatePrice: null, tradingFee: null },
      },
    ]);
    expect(rows[0]).toMatchObject({
      closeQuantity: ONE,
      closePrice: null,
      tradeValue: null,
      openFee: null,
      closeFee: 0n,
      platformFee: null,
      realizedPnl: null,
    });
  });
  afterEach(() => vi.restoreAllMocks());
  it("apportions the opening fee across immutable partial closes", async () => {
    const { rows } = await read([event("first", ONE, 120n * ONE), event("second", ONE, 110n * ONE)]);
    expect(rows[0]).toMatchObject({
      closeQuantity: ONE,
      closePrice: 120n * ONE,
      tradeValue: 120n * ONE,
      openFee: ONE / 10n,
      closeFee: (24n * ONE) / 100n,
      platformFee: (34n * ONE) / 100n,
      realizedPnl: 20n * ONE,
      closedAt: 100,
    });
    expect(rows[1]).toMatchObject({
      openFee: ONE / 10n,
      closeFee: (22n * ONE) / 100n,
      platformFee: (32n * ONE) / 100n,
      closedAt: 200,
    });
    expect(rows[0]!.openFee! + rows[1]!.openFee!).toBe(ONE / 5n);
  });
  it.each([
    QuoteCloseEventType.LiquidatePartyA,
    QuoteCloseEventType.LiquidatePartyB,
    QuoteCloseEventType.LiquidateClearingHouse,
  ])("does not charge close fees for %s", async (type) => {
    const { rows } = await read([event("liquidation", ONE, 60n * ONE, type)]);
    expect(rows[0]).toMatchObject({
      closeQuantity: ONE,
      closePrice: 60n * ONE,
      openFee: ONE / 10n,
      closeFee: 0n,
      platformFee: ONE / 10n,
      realizedPnl: -40n * ONE,
    });
  });
  it.each([QuoteCloseEventType.ForceClose, QuoteCloseEventType.EmergencyClose, QuoteCloseEventType.AdlClose])(
    "retains close fees for %s",
    async (type) => {
      const { rows } = await read([event("close", ONE, 120n * ONE, type)]);
      expect(rows[0]).toMatchObject({ closeFee: (24n * ONE) / 100n, platformFee: (34n * ONE) / 100n });
    },
  );
  it("preserves short PnL and falls back from a zero initial fill price", async () => {
    const row = event("short", ONE, 120n * ONE);
    const { rows } = await read([{ ...row, quote: { ...quote, positionType: 1, initialOpenedPrice: "0" } }]);
    expect(rows[0]).toMatchObject({ realizedPnl: -20n * ONE, openFee: ONE / 10n });
  });
  it("bounds opening-fee rounding loss for three uneven closes", async () => {
    const amounts = [ONE / 3n, ONE / 2n, 2n * ONE - ONE / 3n - ONE / 2n];
    const { rows } = await read(amounts.map((amount, i) => event(String(i), amount, 120n * ONE)));
    const full = calculateOpenPlatformFee({ quantity: 2n * ONE, openedPrice: 100n * ONE, openFeeRate: ONE / 1000n });
    const sum = rows.reduce((total, row) => total + row.openFee!, 0n);
    expect(full - sum).toBeGreaterThanOrEqual(0n);
    expect(full - sum).toBeLessThan(3n);
  });
  it("retains one-wei PnL and explicit zero snapshots", async () => {
    const { rows } = await read([event("dust", ONE, 100n * ONE + 1n), event("zero", 0n, 0n)]);
    expect(rows[0]!.realizedPnl).toBe(1n);
    expect(rows[1]).toMatchObject({ closeQuantity: 0n, closePrice: 0n, platformFee: 0n, realizedPnl: 0n });
  });
  it("preserves unknown metrics and uses liquidation fields without a snapshot", async () => {
    const missing = {
      ...event("missing", ONE, ONE),
      metadata: "{}",
      quote: {
        ...quote,
        closedAmount: null,
        quantity: null,
        averageClosedPrice: null,
        closedPrice: null,
        openedPrice: null,
        initialOpenedPrice: null,
        tradingFee: null,
        closeFee: null,
      },
    };
    const liquidation = {
      ...event("liquidation", ONE, ONE, QuoteCloseEventType.LiquidatePartyA),
      metadata: "{}",
      quote: { ...quote, liquidateAmount: String(ONE), liquidatePrice: String(60n * ONE) },
    };
    const { rows } = await read([missing, liquidation]);
    expect(rows[0]).toMatchObject({
      closeQuantity: null,
      closePrice: null,
      tradeValue: null,
      openFee: null,
      closeFee: null,
      platformFee: null,
      realizedPnl: null,
    });
    expect(rows[1]).toMatchObject({ closeQuantity: ONE, closePrice: 60n * ONE, closeFee: 0n, realizedPnl: -40n * ONE });
  });
});
