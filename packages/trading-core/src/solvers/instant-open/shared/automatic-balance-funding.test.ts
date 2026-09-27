import { toDecimal } from "@symmio/utils/decimal";
import { formatUnits, parseUnits, type PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { PositionType } from "../../../symmio-contracts/symmio/types";

const resolvers = vi.hoisted(() => ({
  resolveMarket: vi.fn(),
  resolveMarkPrice: vi.fn(),
  resolveLockedParams: vi.fn(),
  resolveFeeRates: vi.fn(),
  resolveSolverInfo: vi.fn(),
}));
const fetchOpenEstimatePrice = vi.hoisted(() => vi.fn());
vi.mock("../prepare-instant-open-params/resolvers", () => resolvers);
vi.mock("./open-estimate-guard", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchOpenEstimatePrice,
}));

import { getInstantOpenFees } from "../get-instant-open-fees/get-instant-open-fees";
import { getInstantOpenFeesQueryKey } from "../get-instant-open-fees/query";
import { prepareInstantOpenParams } from "../prepare-instant-open-params/prepare-instant-open-params";
import { getPrepareInstantOpenParamsQueryKey } from "../prepare-instant-open-params/query";

const ACCOUNT = "0x0000000000000000000000000000000000005Ab1";
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.BASE]: {
      addresses: { affiliatesAddress: ACCOUNT },
      defaultSolverId: "enigma",
      solvers: {
        enigma: {
          name: "Enigma",
          address: ACCOUNT,
          url: "https://enigma.test",
          notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "test" },
        },
        rasa: { name: "Rasa", address: ACCOUNT, url: "https://rasa.test" },
      },
    },
  },
});
const params = {
  chainId: SymmioSupportedChainId.BASE,
  subAccountAddress: ACCOUNT,
  market: { id: 1 },
  positionType: PositionType.LONG,
  initialMargin: "100",
  leverage: 2,
  slippage: 1,
  estimatedOpenPrice: "100.5",
} as const;
const market = {
  name: "TEST",
  pricePrecision: 2,
  quantityPrecision: 3,
  hedgerFeeOpen: "0.001",
  hedgerFeeClose: "0.002",
  minAcceptablePortionLf: "0",
  minAcceptableQuoteValue: "0",
  maxNotionalValue: 0,
  minNotionalValue: "0",
  maxQuantity: "0",
  lotSize: "0.01",
};

describe("automatic balance funding", () => {
  beforeEach(() => {
    resolvers.resolveMarket.mockReset().mockResolvedValue(market);
    resolvers.resolveMarkPrice.mockReset().mockResolvedValue("100");
    resolvers.resolveLockedParams.mockReset().mockResolvedValue({ cva: "7", lf: "3", partyAmm: "90", partyBmm: "0" });
    resolvers.resolveFeeRates.mockReset().mockResolvedValue({ openFee: 10n ** 15n, closeFee: 5n * 10n ** 14n });
    resolvers.resolveSolverInfo
      .mockReset()
      .mockResolvedValue({ staticSolverFeeOpen: "0.5", staticSolverFeeClose: "5" });
    fetchOpenEstimatePrice.mockReset().mockResolvedValue(undefined);
  });

  it.each([0n, 1n])("preserves typed sizing at required funding plus %s wei", async (extra) => {
    const typed = await prepareInstantOpenParams(config, params);
    const availableBalance = formatUnits(typed.margin!.amount + extra, 18);
    const actual = await prepareInstantOpenParams(config, { ...params, availableBalance });
    const fees = await getInstantOpenFees(config, { ...params, availableBalance });
    expect(actual).toEqual(typed);
    expect(actual.fundingMode).toBe("initial-margin");
    expect(fees.fundingMode).toBe("initial-margin");
    expect(parseUnits(fees.quantity, 18)).toBe(actual.order.quantity);
  });

  it("falls back when funding exceeds balance by one wei", async () => {
    const typed = await prepareInstantOpenParams(config, params);
    const availableBalance = formatUnits(typed.margin!.amount - 1n, 18);
    const actual = await prepareInstantOpenParams(config, { ...params, availableBalance });
    expect(actual.fundingMode).toBe("full-balance");
    expect(actual.margin!.amount).toBe(typed.margin!.amount - 1n);
    expect(actual.order.quantity).toBeLessThan(typed.order.quantity);
  });

  it.each([
    [PositionType.LONG, "100.5"],
    [PositionType.SHORT, "99.5"],
    [PositionType.LONG, undefined],
    [PositionType.SHORT, undefined],
  ] as const)(
    "matches explicit full-balance sizing and fees for side %s, estimate %s",
    async (positionType, estimatedOpenPrice) => {
      const inputs = { ...params, positionType, estimatedOpenPrice };
      const automatic = { ...inputs, availableBalance: "100" };
      const explicit = { ...inputs, initialMargin: undefined, fund: { mode: "full-balance", balance: "100" } as const };
      const prepared = await prepareInstantOpenParams(config, automatic);
      const fees = await getInstantOpenFees(config, automatic);
      expect(prepared).toEqual(await prepareInstantOpenParams(config, explicit));
      expect(fees).toEqual(await getInstantOpenFees(config, explicit));
      expect(prepared.fundingMode).toBe("full-balance");
      expect(prepared.margin!.amount).toBe(parseUnits("100", 18));
      expect(parseUnits(fees.quantity, 18)).toBe(prepared.order.quantity);
      expect(toDecimal(fees.quantity).mod(market.lotSize).isZero()).toBe(true);
      const signedLocks = prepared.lockedParam.cva + prepared.lockedParam.lf + prepared.lockedParam.partyAmm;
      expect(signedLocks + parseUnits(fees.totalFee, 18)).toBeLessThanOrEqual(prepared.margin!.amount);
      expect(resolvers.resolveMarket).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ includeQuoteConstraints: true }),
      );
    },
  );

  it.each(["100.000000000000000001", "101", "1000"])(
    "rejects typed margin %s above the balance before resolving trade inputs",
    async (initialMargin) => {
      for (const action of [prepareInstantOpenParams, getInstantOpenFees]) {
        await expect(action(config, { ...params, initialMargin, availableBalance: "100" })).rejects.toMatchObject({
          code: "INVALID_TRADE_PARAMETERS",
          message: "Initial margin exceeds available balance.",
        });
      }
      expect(resolvers.resolveMarket).not.toHaveBeenCalled();
      expect(fetchOpenEstimatePrice).not.toHaveBeenCalled();
    },
  );

  it("restores typed sizing after reducing an over-balance input", async () => {
    await expect(
      prepareInstantOpenParams(config, { ...params, initialMargin: "101", availableBalance: "100" }),
    ).rejects.toThrow("Initial margin exceeds available balance.");
    const under = await prepareInstantOpenParams(config, { ...params, initialMargin: "50", availableBalance: "100" });
    expect(under.fundingMode).toBe("initial-margin");
    expect(under.margin!.amount).toBeLessThan(parseUnits("100", 18));
  });

  it("rejects a typed margin above balance even when its calculated locks and fees would fit", async () => {
    resolvers.resolveLockedParams.mockResolvedValue({ cva: "7", lf: "3", partyAmm: "40", partyBmm: "0" });
    for (const action of [prepareInstantOpenParams, getInstantOpenFees]) {
      await expect(action(config, { ...params, initialMargin: "150", availableBalance: "100" })).rejects.toThrow(
        "Initial margin exceeds available balance.",
      );
    }
    expect(resolvers.resolveMarket).not.toHaveBeenCalled();
  });

  it("recalculates when only balance changes", async () => {
    const low = await prepareInstantOpenParams(config, { ...params, availableBalance: "100" });
    const high = await prepareInstantOpenParams(config, { ...params, availableBalance: "200" });
    expect(low.fundingMode).toBe("full-balance");
    expect(high.fundingMode).toBe("initial-margin");
    for (const key of [getPrepareInstantOpenParamsQueryKey, getInstantOpenFeesQueryKey]) {
      expect(key({ ...params, availableBalance: "100" })).not.toEqual(key({ ...params, availableBalance: "200" }));
    }
  });

  it("preserves the price-bound fallback for the legacy zero estimate sentinel", async () => {
    const fees = await getInstantOpenFees(config, { ...params, availableBalance: "100", estimatedOpenPrice: "0" });
    const withoutEstimate = await getInstantOpenFees(config, {
      ...params,
      availableBalance: "100",
      estimatedOpenPrice: undefined,
    });
    expect(fees).toEqual(withoutEstimate);
    expect(fees.kind === "enigma" && toDecimal(fees.expectedSettlementLoss).gt(0)).toBe(true);
  });

  it.each([1, undefined])("uses an explicitly unavailable estimate consistently, slippage=%s", async (slippage) => {
    const inputs = { ...params, availableBalance: "100", estimatedOpenPrice: null, slippage };
    const prepared = await prepareInstantOpenParams(config, inputs);
    const fees = await getInstantOpenFees(config, inputs);
    expect(fetchOpenEstimatePrice).not.toHaveBeenCalled();
    expect(prepared.fundingMode).toBe("full-balance");
    expect(fees.fundingMode).toBe(prepared.fundingMode);
    expect(parseUnits(fees.quantity, 18)).toBe(prepared.order.quantity);
    expect(fees.kind === "enigma" && toDecimal(fees.expectedSettlementLoss).gt(0)).toBe(true);
    expect(prepared.margin!.amount).toBe(parseUnits("100", 18));
  });

  it.each([prepareInstantOpenParams, getInstantOpenFees])(
    "attempts an omitted estimate only once during auto slippage",
    async (action) => {
      await action(config, { ...params, estimatedOpenPrice: undefined, slippage: undefined });
      expect(fetchOpenEstimatePrice).toHaveBeenCalledTimes(1);
    },
  );

  it("includes settlement in sizing even when excluded from the displayed fee total", async () => {
    const normal = await getInstantOpenFees(config, { ...params, availableBalance: "100" });
    const feesOnly = await getInstantOpenFees(config, {
      ...params,
      availableBalance: "100",
      includeSettlementInTotalFee: false,
    });
    expect(feesOnly.quantity).toBe(normal.quantity);
    expect(feesOnly.fundingMode).toBe(normal.fundingMode);
    expect(toDecimal(feesOnly.totalFee).lt(normal.totalFee)).toBe(true);
  });

  it.each(["0", "-1", "NaN", "Infinity", "invalid"])(
    "rejects invalid available balance %s",
    async (availableBalance) => {
      for (const action of [prepareInstantOpenParams, getInstantOpenFees]) {
        await expect(action(config, { ...params, availableBalance })).rejects.toMatchObject({
          code: "INVALID_TRADE_PARAMETERS",
        });
      }
      expect(resolvers.resolveMarket).not.toHaveBeenCalled();
    },
  );

  it("rejects unsupported and ambiguous funding", async () => {
    for (const action of [prepareInstantOpenParams, getInstantOpenFees]) {
      await expect(action(config, { ...params, availableBalance: "100", solverId: "rasa" })).rejects.toMatchObject({
        code: "FULL_BALANCE_UNSUPPORTED",
      });
      await expect(
        action(config, {
          ...params,
          initialMargin: undefined,
          availableBalance: "100",
          fund: { mode: "full-balance", balance: "100" },
        }),
      ).rejects.toMatchObject({ code: "AMBIGUOUS_FUNDING" });
    }
  });

  it("still rejects a balance that cannot cover the static open fee", async () => {
    for (const action of [prepareInstantOpenParams, getInstantOpenFees]) {
      await expect(action(config, { ...params, initialMargin: "0.5", availableBalance: "0.5" })).rejects.toMatchObject({
        code: "INVALID_TRADE_PARAMETERS",
      });
    }
  });

  it("still rejects a resized position below the market minimum", async () => {
    resolvers.resolveMarket.mockResolvedValue({ ...market, minNotionalValue: "500" });
    for (const action of [prepareInstantOpenParams, getInstantOpenFees]) {
      await expect(action(config, { ...params, availableBalance: "100" })).rejects.toMatchObject({
        code: "QUOTE_CONSTRAINT_VIOLATED",
      });
    }
  });
});
