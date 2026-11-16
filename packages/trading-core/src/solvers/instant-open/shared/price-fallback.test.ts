import { AxiosError } from "axios";
import { decodeFunctionData, formatUnits, parseUnits } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../../symmio-contracts/abi/v0.8.6/symmio";
import { getInstantOpenFees } from "../get-instant-open-fees/get-instant-open-fees";
import { instantOpenAuto } from "../instant-open-auto/instant-open-auto";
import { prepareInstantOpenParams } from "../prepare-instant-open-params/prepare-instant-open-params";
import { PositionType } from "./types";

const { estimate, post } = vi.hoisted(() => ({ estimate: vi.fn(), post: vi.fn() }));
vi.mock("../../types/generated/enigma-solver", async (original) => ({
  ...(await original<typeof import("../../types/generated/enigma-solver")>()),
  getEstimatedPrice: estimate,
  postInstantTradeInstantOpen: post,
}));

const parameters = {
  solverId: "enigma",
  subAccountAddress: TEST_USER,
  positionType: PositionType.LONG,
  market: {
    id: 1,
    name: "TEST",
    pricePrecision: 4,
    quantityPrecision: 6,
    minOpenSolverFeeCap: "0.01",
    minCloseSolverFeeCap: "0.01",
    hedgerFeeOpen: "0.002",
    hedgerFeeClose: "0",
    minAcceptablePortionLf: "0",
    minAcceptableQuoteValue: "1",
    maxNotionalValue: 10000,
    minNotionalValue: "1",
    maxQuantity: "10000",
    lotSize: "0.000001",
  },
  initialMargin: "100",
  leverage: 2,
  slippage: 1,
  markPrice: "100",
  feeRates: { openFee: parseUnits("0.001", 18), closeFee: 0n, isSet: true },
  solverInfo: { staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0" },
  lockedParamPercent: { cva: "7", lf: "3", partyAmm: "90", partyBmm: "0" },
  preflightDelegation: false,
} as const;

describe("instant-open price fallback", () => {
  beforeEach(() => {
    estimate.mockReset().mockRejectedValue(new AxiosError("network unavailable", "ERR_NETWORK"));
    post.mockReset().mockResolvedValue({ data: { temp_quote_id: 7 } });
  });

  it.each([PositionType.LONG, PositionType.SHORT])(
    "signs the original slippage bound and sends once for side %s",
    async (positionType) => {
      const { config, signTypedData } = mockConfig();
      const result = await instantOpenAuto(config, { ...parameters, positionType });
      expect(result).toMatchObject({ success: true, openEstimateStatus: "unavailable", estimatedOpenPrice: null });
      expect(estimate).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledTimes(1);
      const target = config.getChainConfig().addresses.symmioAddress;
      const signed = signTypedData.mock.calls.find(([input]) => input.message.target === target)?.[0];
      expect(signed).toBeDefined();
      const quote = decodeFunctionData({ abi: symmioAbi, data: signed.message.callData });
      expect(quote.functionName).toBe("sendQuote");
      expect(quote.args?.[4]).toBe(parseUnits(positionType === PositionType.LONG ? "101" : "99", 18));
      expect(quote.args?.[5]).toBe(parseUnits("2", 18));
    },
  );

  it.each([PositionType.LONG, PositionType.SHORT])(
    "keeps fees, funding and quantity aligned for side %s",
    async (positionType) => {
      const { config } = mockConfig();
      for (const fullBalance of [false, true]) {
        const input = {
          ...parameters,
          positionType,
          initialMargin: fullBalance ? undefined : "100",
          fund: fullBalance ? { mode: "full-balance" as const, balance: "100" } : undefined,
        };
        const prepared = await prepareInstantOpenParams(config, input);
        const fees = await getInstantOpenFees(config, { ...input, estimatedOpenPrice: prepared.estimatedOpenPrice });
        expect(fees).toMatchObject({
          openEstimateStatus: "unavailable",
          estimatedOpenPrice: null,
          fundingMode: prepared.fundingMode,
        });
        expect(parseUnits(fees.quantity, 18)).toBe(prepared.order.quantity);
        const delta =
          positionType === PositionType.LONG
            ? prepared.order.price - prepared.markPrice!
            : prepared.markPrice! - prepared.order.price;
        expect(fees.kind).toBe("enigma");
        if (fees.kind === "enigma") {
          expect(parseUnits(fees.expectedSettlementLoss, 18)).toBe((delta * prepared.order.quantity) / 10n ** 18n);
        }
        expect(prepared.margin!.amount).toBeGreaterThan(parseUnits(fees.totalFee, 18));
        if (fullBalance) expect(formatUnits(prepared.margin!.amount, 18)).toBe("100");
      }
      expect(estimate).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["0", "-1", "NaN", "Infinity", "invalid", "0.00000000000000000001"])(
    "rejects unusable reference %s before estimating or signing",
    async (markPrice) => {
      const { config, signTypedData } = mockConfig();
      await expect(instantOpenAuto(config, { ...parameters, markPrice })).rejects.toMatchObject({
        code: "OPEN_PRICE_UNAVAILABLE",
      });
      expect(estimate).not.toHaveBeenCalled();
      expect(signTypedData).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it.each(["0", "-1", "NaN", "Infinity", "invalid"])(
    "treats prefetched invalid estimate %s like an unavailable fetched estimate",
    async (estimatedOpenPrice) => {
      const { config } = mockConfig();
      const fallback = await prepareInstantOpenParams(config, { ...parameters, estimatedOpenPrice: null });
      await expect(prepareInstantOpenParams(config, { ...parameters, estimatedOpenPrice })).resolves.toEqual(fallback);
      expect(estimate).not.toHaveBeenCalled();
    },
  );

  it.each(["price", "refusal"])("does not sign or submit an out-of-tolerance %s", async (kind) => {
    const { config, signTypedData } = mockConfig();
    estimate.mockResolvedValue({
      status: 200,
      data: kind === "price" ? { price: "110" } : { code: 3401, error_detail: "Slippage Too Low" },
    });
    await expect(instantOpenAuto(config, parameters)).rejects.toMatchObject({
      code: kind === "price" ? "SLIPPAGE_EXCEEDED" : "OPEN_ESTIMATE_REJECTED",
    });
    expect(signTypedData).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
