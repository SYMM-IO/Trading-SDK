import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { PositionType } from "../../../symmio-contracts/symmio/types";

const resolveMarket = vi.hoisted(() => vi.fn());
const resolveMarkPrice = vi.hoisted(() => vi.fn());
const resolveFeeRates = vi.hoisted(() => vi.fn());
const resolveLockedParams = vi.hoisted(() => vi.fn());
const resolveSolverInfo = vi.hoisted(() => vi.fn());
const fetchOpenEstimatePrice = vi.hoisted(() => vi.fn());

vi.mock("../prepare-instant-open-params/resolvers", () => ({
  resolveMarket,
  resolveMarkPrice,
  resolveFeeRates,
  resolveLockedParams,
  resolveSolverInfo,
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
    resolveSolverInfo.mockReset().mockResolvedValue({ staticSolverFeeOpen: "0", staticSolverFeeClose: "0" });
    fetchOpenEstimatePrice.mockReset().mockResolvedValue("101.5");
  });

  it("returns the full Enigma open-side breakdown and the total", async () => {
    const fees = await getInstantOpenFees(config, PARAMS);

    // quantity = 100×2/100 = 2; requestedOpenPrice = 101.00; notional = 2 × 101 = 202
    expect(fees).toEqual({
      fundingMode: "initial-margin",
      kind: "enigma",
      notional: "202",
      quantity: "2.000",
      platformOpenFee: "0.202", // 202 × 0.001
      openSolverFee: "0.202", // 202 × 0.001
      staticSolverFeeOpen: "0",
      expectedSettlementLoss: "3", // (101.5 − 100) × 2
      totalFee: "3.404", // open legs + settlement provision
    });
  });

  it("excludes the settlement provision from the total when the flag is off", async () => {
    const fees = await getInstantOpenFees(config, { ...PARAMS, includeSettlementInTotalFee: false });

    expect(fees.kind === "enigma" && fees.expectedSettlementLoss).toBe("3"); // still reported as its own leg
    expect(fees.totalFee).toBe("0.404"); // fee legs only
  });

  it("adds the flat static open leg to the breakdown and the total", async () => {
    resolveSolverInfo.mockResolvedValue({ staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0.25" });

    const fees = await getInstantOpenFees(config, { ...PARAMS, solverInfo: { staticSolverFeeOpen: "0.5" } });

    // Same rate legs as the base case + flat 0.5 → 3.404 + 0.5. The static
    // close leg is not part of the open preview — it is charged at close.
    expect(fees.kind === "enigma" && fees.staticSolverFeeOpen).toBe("0.5");
    expect(fees.totalFee).toBe("3.904");
    // The pre-fetched solverInfo is forwarded so the resolver can skip its fetch.
    expect(resolveSolverInfo).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ solverInfo: { staticSolverFeeOpen: "0.5" } }),
    );
  });

  it("returns the platform open leg only on a majors solver — no estimate call", async () => {
    const fees = await getInstantOpenFees(config, { ...PARAMS, solverId: "rasa" });

    expect(fees).toEqual({
      fundingMode: "initial-margin",
      kind: "rasa",
      notional: "202",
      quantity: "2.000",
      platformOpenFee: "0.202",
      totalFee: "0.202",
    });
    expect(fetchOpenEstimatePrice).not.toHaveBeenCalled();
    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeHedgerFees: false }));
    // The static open fee is a lowcap leg — the majors path never resolves it.
    expect(resolveSolverInfo).not.toHaveBeenCalled();
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
    expect(fees.totalFee).toBe("0.404"); // platform open 0.202 + solver open 0.202
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

      // Probe at balance 100 funds open-side only: locks 101 (percents sum 100
      // at requested 101) + platform open 0.202 + solver open 0.202 +
      // settlement 3 = 104.404 → factor 100/104.404 × 0.999 → quantity 1.912,
      // notional 193.112; every leg is then re-priced on the rescaled size.
      expect(fees).toEqual({
        fundingMode: "full-balance",
        kind: "enigma",
        notional: "193.112",
        quantity: "1.912",
        platformOpenFee: "0.193112",
        openSolverFee: "0.193112",
        staticSolverFeeOpen: "0",
        expectedSettlementLoss: "2.868", // (101.5 − 100) × 1.912
        totalFee: "3.254224", // open legs + settlement provision
      });
      expect(resolveLockedParams).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ marketName: "TEST", leverage: 2 }),
      );
      expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeQuoteConstraints: true }));
    });

    it("carves the static open fee off the balance and reports it in the legs", async () => {
      // First preview prices the static leg; the second falls back to the
      // beforeEach zero-leg default for the comparison baseline.
      resolveSolverInfo.mockResolvedValueOnce({ staticSolverFeeOpen: "5", staticSolverFeeClose: "5" });

      const withStatics = await getInstantOpenFees(config, FUND_PARAMS);
      const withoutStatics = await getInstantOpenFees(config, FUND_PARAMS);

      if (withStatics.kind !== "enigma" || withoutStatics.kind !== "enigma") throw new Error("expected enigma fees");
      expect(withStatics.staticSolverFeeOpen).toBe("5");
      // The flat open leg shrinks the sizing budget, so the position gets smaller.
      expect(Number(withStatics.quantity)).toBeLessThan(Number(withoutStatics.quantity));
      // And the total carries the static leg on top of the rate legs.
      expect(Number(withStatics.totalFee)).toBeGreaterThan(Number(withoutStatics.totalFee));
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
