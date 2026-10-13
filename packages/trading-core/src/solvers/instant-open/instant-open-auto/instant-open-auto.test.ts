import { parseUnits } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { PositionType } from "../../../symmio-contracts/symmio/types";
import { instantOpenAuto } from "./instant-open-auto";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../types/generated/enigma-solver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../types/generated/enigma-solver")>()),
  postInstantTradeInstantOpen: post,
}));
const params = {
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
  fund: { mode: "full-balance", balance: "100" },
  leverage: 2,
  slippage: 1,
  markPrice: "100",
  estimatedOpenPrice: "100.5",
  feeRates: { openFee: parseUnits("0.001", 18), closeFee: 0n, isSet: true },
  solverInfo: { staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0" },
  lockedParamPercent: { cva: "7", lf: "3", partyAmm: "90", partyBmm: "0" },
} as const;

describe("instantOpenAuto", () => {
  afterEach(() => vi.clearAllMocks());
  it.each([PositionType.LONG, PositionType.SHORT])(
    "submits a fee-inclusive budget and delayed estimate without reading the balance for side %s",
    async (positionType) => {
      const { config, readContract, signTypedData } = mockConfig();
      readContract.mockRejectedValue(new Error("Unexpected contract read"));
      post.mockResolvedValue({ data: { temp_quote_id: 7 } });
      await expect(
        instantOpenAuto(config, {
          ...params,
          positionType,
          estimatedOpenPrice: positionType === PositionType.LONG ? "100.5" : "99.5",
          estimatedOpenPriceTimestamp: Date.now() - 120_000,
        }),
      ).resolves.toMatchObject({ success: true });
      expect(readContract).not.toHaveBeenCalled();
      expect(signTypedData).toHaveBeenCalledTimes(2);
      expect(post).toHaveBeenCalledTimes(1);
    },
  );
});
