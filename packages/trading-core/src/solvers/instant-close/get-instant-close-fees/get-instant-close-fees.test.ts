import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";

const resolveMarket = vi.hoisted(() => vi.fn());
const resolveMarkPrice = vi.hoisted(() => vi.fn());
const resolveFeeRates = vi.hoisted(() => vi.fn());
const resolveSolverInfo = vi.hoisted(() => vi.fn());

vi.mock("../../shared/resolvers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveMarket,
  resolveMarkPrice,
  resolveFeeRates,
  resolveSolverInfo,
}));

import { getInstantCloseFees } from "./get-instant-close-fees";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const SUB_ACCOUNT = "0x0000000000000000000000000000000000005Ab1";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.BASE]: {
      addresses: { affiliatesAddress: AFFILIATE },
      defaultSolverId: "enigma",
      solvers: {
        enigma: {
          name: "Enigma",
          address: AFFILIATE,
          url: "https://enigma.test",
          notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "test" },
        },
        rasa: { name: "Rasa", address: AFFILIATE, url: "https://rasa.test" },
      },
    },
  },
});

/** quantity 2 at mark 100 → notional 200; platform close 0.05% → 0.1. */
const PARAMS = {
  chainId: SymmioSupportedChainId.BASE,
  subAccountAddress: SUB_ACCOUNT,
  market: { id: 1 },
  quantity: "2",
} as const;

const NOW = 1_700_000_000;

describe("getInstantCloseFees", () => {
  beforeEach(() => {
    resolveMarket.mockReset().mockResolvedValue({
      name: "TEST",
      pricePrecision: 2,
      quantityPrecision: 3,
      hedgerFeeOpen: "0.001",
      hedgerFeeClose: "0.0006",
      hedgerFeeCloseEarlyRate: "0.0024",
      hedgerFeeCloseEarlyThreshold: 30,
      hedgerFeeCloseStandardThreshold: 180,
    });
    resolveMarkPrice.mockReset().mockResolvedValue("100");
    // 0.1% open / 0.05% close in 18-decimal fixed point.
    resolveFeeRates.mockReset().mockResolvedValue({ openFee: 10n ** 15n, closeFee: 5n * 10n ** 14n });
    resolveSolverInfo.mockReset().mockResolvedValue({ staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0" });
  });

  it("prices the worst case (early rate) when openedAt is unknown", async () => {
    const fees = await getInstantCloseFees(config, PARAMS);

    // rate 0.0024 × 200 = 0.48; platform 0.1.
    expect(fees).toEqual({
      kind: "enigma",
      platformCloseFee: "0.1",
      notional: "200",
      closeSolverFee: "0.48",
      closeSolverFeeRate: "0.0024",
      holdingSeconds: 0,
      staticSolverFeeClose: "0",
      totalFee: "0.58",
    });
  });

  it("prices the standard (floor) rate once the position aged past the schedule", async () => {
    const fees = await getInstantCloseFees(config, { ...PARAMS, openedAt: NOW - 180, now: NOW });

    // rate 0.0006 × 200 = 0.12.
    expect(fees.kind === "enigma" && fees.closeSolverFee).toBe("0.12");
    expect(fees.kind === "enigma" && fees.holdingSeconds).toBe(180);
    expect(fees.totalFee).toBe("0.22");
  });

  it("interpolates the decaying rate at a mid-schedule holding time", async () => {
    const fees = await getInstantCloseFees(config, { ...PARAMS, openedAt: NOW - 105, now: NOW });

    // midpoint of 0.0024 → 0.0006 at t = 105 of [30, 180] → 0.0015 × 200 = 0.3.
    expect(fees.kind === "enigma" && fees.closeSolverFeeRate).toBe("0.0015");
    expect(fees.kind === "enigma" && fees.closeSolverFee).toBe("0.3");
    expect(fees.totalFee).toBe("0.4");
  });

  it("clamps a future openedAt (clock skew) to the worst case", async () => {
    const fees = await getInstantCloseFees(config, { ...PARAMS, openedAt: NOW + 50, now: NOW });

    expect(fees.kind === "enigma" && fees.holdingSeconds).toBe(0);
    expect(fees.kind === "enigma" && fees.closeSolverFee).toBe("0.48");
  });

  it("adds the flat static close leg to the breakdown and the total", async () => {
    resolveSolverInfo.mockResolvedValue({ staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0.25" });

    const fees = await getInstantCloseFees(config, { ...PARAMS, openedAt: NOW - 180, now: NOW });

    expect(fees.kind === "enigma" && fees.staticSolverFeeClose).toBe("0.25");
    expect(fees.totalFee).toBe("0.47"); // 0.1 + 0.12 + 0.25
  });

  it("returns the platform leg only on a majors solver — no solver-info resolution", async () => {
    const fees = await getInstantCloseFees(config, { ...PARAMS, solverId: "rasa" });

    expect(fees).toEqual({
      kind: "rasa",
      platformCloseFee: "0.1",
      notional: "200",
      totalFee: "0.1",
    });
    expect(resolveSolverInfo).not.toHaveBeenCalled();
    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeHedgerFees: false }));
  });

  it("forwards pre-fetched inputs so their fetches are skipped", async () => {
    const solverInfo = { staticSolverFeeClose: "0.25" };
    await getInstantCloseFees(config, {
      ...PARAMS,
      markPrice: "101",
      feeRates: { openFee: 0n, closeFee: 0n, isSet: true },
      solverInfo,
    });

    expect(resolveMarkPrice).toHaveBeenCalledWith(config, expect.objectContaining({ markPrice: "101" }));
    expect(resolveFeeRates).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ feeRates: { openFee: 0n, closeFee: 0n, isSet: true } }),
    );
    expect(resolveSolverInfo).toHaveBeenCalledWith(config, expect.objectContaining({ solverInfo }));
  });

  it("throws INVALID_TRADE_PARAMETERS on a non-positive quantity before any fetch", async () => {
    await expect(getInstantCloseFees(config, { ...PARAMS, quantity: "0" })).rejects.toThrow(
      /INVALID_TRADE_PARAMETERS|positive/,
    );
    await expect(getInstantCloseFees(config, { ...PARAMS, quantity: "abc" })).rejects.toThrow(
      /INVALID_TRADE_PARAMETERS|positive/,
    );
    expect(resolveMarket).not.toHaveBeenCalled();
  });

  it("throws INVALID_TRADE_PARAMETERS when the resolved mark price is unusable", async () => {
    resolveMarkPrice.mockResolvedValue("0");

    await expect(getInstantCloseFees(config, PARAMS)).rejects.toThrow(/INVALID_TRADE_PARAMETERS|mark price/);
  });
});
