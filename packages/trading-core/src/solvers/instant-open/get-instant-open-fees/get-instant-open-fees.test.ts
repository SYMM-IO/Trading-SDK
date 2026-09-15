import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { PositionType } from "../../../symmio-contracts/symmio/types";

const resolveMarket = vi.hoisted(() => vi.fn());
const resolveMarkPrice = vi.hoisted(() => vi.fn());
const resolveFeeRates = vi.hoisted(() => vi.fn());
const resolveLockedParams = vi.hoisted(() => vi.fn());
const fetchOpenEstimatePrice = vi.hoisted(() => vi.fn());

vi.mock("../prepare-instant-open-params/resolvers", () => ({
  resolveMarket,
  resolveMarkPrice,
  resolveFeeRates,
  resolveLockedParams,
}));
vi.mock("../shared/open-estimate-guard", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchOpenEstimatePrice,
}));

import { getInstantOpenFees } from "./get-instant-open-fees";

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

/** Margin 100 × leverage 2 at mark 100 → quantity 2, notional (at 1% bound 101) = 202. */
const PARAMS = {
  chainId: SymmioSupportedChainId.BASE,
  subAccountAddress: SUB_ACCOUNT,
  market: { id: 1 },
  positionType: PositionType.LONG,
  initialMargin: "100",
  leverage: 2,
  slippage: 1,
} as const;

describe("getInstantOpenFees", () => {
  beforeEach(() => {
    resolveMarket.mockReset().mockResolvedValue({
      name: "TEST",
      pricePrecision: 2,
      quantityPrecision: 3,
      hedgerFeeOpen: "0.001",
      hedgerFeeClose: "0.002",
    });
    resolveMarkPrice.mockReset().mockResolvedValue("100");
    // 0.1% open / 0.05% close in 18-decimal fixed point.
    resolveFeeRates.mockReset().mockResolvedValue({ openFee: 10n ** 15n, closeFee: 5n * 10n ** 14n });
    resolveLockedParams.mockReset().mockResolvedValue({ cva: "7", lf: "3", partyAmm: "90", partyBmm: "0" });
    fetchOpenEstimatePrice.mockReset().mockResolvedValue("101.5");
  });

  it("returns the full Enigma breakdown with every leg and the total", async () => {
    const fees = await getInstantOpenFees(config, PARAMS);

    // quantity = 100×2/100 = 2; requestedOpenPrice = 101.00; notional = 2 × 101 = 202
    expect(fees).toEqual({
      kind: "enigma",
      notional: "202",
      quantity: "2.000",
      platformOpenFee: "0.202", // 202 × 0.001
      platformCloseFee: "0.101", // 202 × 0.0005
      openSolverFee: "0.202", // 202 × 0.001
      closeSolverFee: "0.404", // 202 × 0.002
      expectedSettlementLoss: "3", // (101.5 − 100) × 2
      totalFee: "3.909",
    });
  });

  it("returns platform legs only on a majors solver — no estimate call", async () => {
    const fees = await getInstantOpenFees(config, { ...PARAMS, solverId: "rasa" });

    expect(fees).toEqual({
      kind: "rasa",
      notional: "202",
      quantity: "2.000",
      platformOpenFee: "0.202",
      platformCloseFee: "0.101",
      totalFee: "0.303",
    });
    expect(fetchOpenEstimatePrice).not.toHaveBeenCalled();
    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeHedgerFees: false }));
  });

  it("uses a caller-supplied estimatedOpenPrice without fetching", async () => {
    const fees = await getInstantOpenFees(config, { ...PARAMS, estimatedOpenPrice: "102" });

    expect(fetchOpenEstimatePrice).not.toHaveBeenCalled();
    expect(fees.kind === "enigma" && fees.expectedSettlementLoss).toBe("4"); // (102 − 100) × 2
  });

  it("provisions zero settlement loss when no estimate is available", async () => {
    fetchOpenEstimatePrice.mockResolvedValue(undefined);

    const fees = await getInstantOpenFees(config, PARAMS);

    expect(fees.kind === "enigma" && fees.expectedSettlementLoss).toBe("0");
    expect(fees.totalFee).toBe("0.909");
  });

  it("auto-derives slippage on lowcap when omitted, reusing one estimate fetch", async () => {
    const fees = await getInstantOpenFees(config, { ...PARAMS, slippage: undefined });

    expect(fetchOpenEstimatePrice).toHaveBeenCalledTimes(1);
    expect(fees.kind).toBe("enigma");
  });

  it("requires slippage on a majors solver", async () => {
    await expect(getInstantOpenFees(config, { ...PARAMS, solverId: "rasa", slippage: undefined })).rejects.toThrow(
      /SLIPPAGE_REQUIRED|slippage is required/,
    );
  });

  it("throws INVALID_SLIPPAGE on a malformed slippage before any fetch", async () => {
    await expect(getInstantOpenFees(config, { ...PARAMS, slippage: -1 })).rejects.toThrow(/Invalid slippage/);
    expect(resolveMarket).not.toHaveBeenCalled();
  });

  describe("full-balance funding", () => {
    const FUND_PARAMS = {
      chainId: PARAMS.chainId,
      subAccountAddress: PARAMS.subAccountAddress,
      market: PARAMS.market,
      positionType: PARAMS.positionType,
      leverage: PARAMS.leverage,
      slippage: PARAMS.slippage,
      fund: { mode: "full-balance", balance: "100" },
    } as const;

    it("previews the exact rescaled trade the open will submit", async () => {
      const fees = await getInstantOpenFees(config, FUND_PARAMS);

      // Probe at balance 100: locks 101 (percents sum 100 at requested 101) +
      // platform 0.303 + solver 0.606 + settlement 3 = 104.909 → factor
      // 100/104.909 × 0.999 → quantity 1.904, notional 192.304; every leg is
      // then re-priced on the rescaled size.
      expect(fees).toEqual({
        kind: "enigma",
        notional: "192.304",
        quantity: "1.904",
        platformOpenFee: "0.192304",
        platformCloseFee: "0.096152",
        openSolverFee: "0.192304",
        closeSolverFee: "0.384608",
        expectedSettlementLoss: "2.856", // (101.5 − 100) × 1.904
        totalFee: "3.721368",
      });
      expect(resolveLockedParams).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ marketName: "TEST", leverage: 2 }),
      );
      expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeQuoteConstraints: true }));
    });

    it("does not resolve locked params for a typed-margin preview", async () => {
      await getInstantOpenFees(config, PARAMS);

      expect(resolveLockedParams).not.toHaveBeenCalled();
      expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeQuoteConstraints: false }));
    });

    it("rejects passing both initialMargin and fund", async () => {
      await expect(
        getInstantOpenFees(config, { ...PARAMS, fund: { mode: "full-balance", balance: "100" } }),
      ).rejects.toThrow(/AMBIGUOUS_FUNDING|exactly one/);
    });

    it("rejects full-balance funding on a non-lowcap solver", async () => {
      await expect(getInstantOpenFees(config, { ...FUND_PARAMS, solverId: "rasa" })).rejects.toThrow(
        /FULL_BALANCE_UNSUPPORTED|lowcap/,
      );
    });

    it("rejects when neither funding source is provided", async () => {
      await expect(getInstantOpenFees(config, { ...PARAMS, initialMargin: undefined })).rejects.toThrow(
        /INITIAL_MARGIN_REQUIRED|pass initialMargin/,
      );
    });
  });
});
