import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { PositionType } from "../../../symmio-contracts/symmio/types";

const resolveMarket = vi.hoisted(() => vi.fn());
const resolveMarkPrice = vi.hoisted(() => vi.fn());
const resolveLockedParams = vi.hoisted(() => vi.fn());
const resolveFeeRates = vi.hoisted(() => vi.fn());
const assertValidSlippage = vi.hoisted(() => vi.fn());
const assertOpenEstimateWithinSlippage = vi.hoisted(() => vi.fn());
const fetchOpenEstimatePrice = vi.hoisted(() => vi.fn());
const deriveAutoSlippage = vi.hoisted(() => vi.fn());

vi.mock("./resolvers", () => ({ resolveMarket, resolveMarkPrice, resolveLockedParams, resolveFeeRates }));
vi.mock("../shared/open-estimate-guard", () => ({
  assertValidSlippage,
  assertOpenEstimateWithinSlippage,
  fetchOpenEstimatePrice,
  deriveAutoSlippage,
}));

import { prepareInstantOpenParams } from "./prepare-instant-open-params";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const FROM = "0x000000000000000000000000000000000000f200";
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

const PARAMS = {
  chainId: SymmioSupportedChainId.BASE,
  from: FROM,
  subAccountAddress: SUB_ACCOUNT,
  market: { id: 1 },
  positionType: PositionType.LONG,
  initialMargin: "100",
  leverage: 2,
  slippage: 1,
} as const;

/** Same synthetic chain, restated as a v0.8.6 deployment via the override merge. */
const cappedConfig = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.BASE]: {
      contractsVersion: "0.8.6",
      addresses: { affiliatesAddress: AFFILIATE },
    },
  },
});

describe("prepareInstantOpenParams", () => {
  beforeEach(() => {
    resolveMarket.mockReset().mockResolvedValue({ name: "BTCUSDT", pricePrecision: 2, quantityPrecision: 3 });
    resolveMarkPrice.mockReset().mockResolvedValue("64790.2");
    resolveLockedParams.mockReset().mockResolvedValue({ cva: "7", lf: "3", partyAmm: "90", partyBmm: "0" });
    resolveFeeRates.mockReset().mockResolvedValue({ openFee: 0n, closeFee: 0n });
    assertValidSlippage.mockReset();
    assertOpenEstimateWithinSlippage.mockReset().mockResolvedValue(undefined);
    fetchOpenEstimatePrice.mockReset().mockResolvedValue(undefined);
    deriveAutoSlippage.mockReset().mockReturnValue(4);
  });

  /**
   * The defect this guards: every resolver feeds a value that is signed into the
   * EIP-712 payload, so a dropped `solverId` yields a quote priced and sized by
   * the wrong solver — with green types and no error.
   */
  it("forwards solverId to every solver-scoped resolver", async () => {
    await prepareInstantOpenParams(config, { ...PARAMS, solverId: "rasa" });

    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ solverId: "rasa" }));
    expect(resolveMarkPrice).toHaveBeenCalledWith(config, expect.objectContaining({ solverId: "rasa" }));
    expect(resolveLockedParams).toHaveBeenCalledWith(config, expect.objectContaining({ solverId: "rasa" }));
  });

  /**
   * `instantOpen` resolves `partyBsWhiteList` from this field and signs it, so
   * losing it here would sign against the default solver's address.
   */
  it("carries solverId into the returned InstantOpenParameters", async () => {
    const result = await prepareInstantOpenParams(config, { ...PARAMS, solverId: "rasa" });

    expect(result.solverId).toBe("rasa");
  });

  it("asks resolveMarket for the solver-fee caps on a v0.8.6 chain and converts them to 18-decimal wei", async () => {
    resolveMarket.mockResolvedValue({
      name: "BTCUSDT",
      pricePrecision: 2,
      quantityPrecision: 3,
      minOpenSolverFeeCap: "0.0005",
      minCloseSolverFeeCap: "0.0003",
    });

    const result = await prepareInstantOpenParams(cappedConfig, PARAMS);

    expect(resolveMarket).toHaveBeenCalledWith(cappedConfig, expect.objectContaining({ includeSolverFeeCaps: true }));
    expect(result.solverFeeCaps).toEqual({ openRateCap: 500000000000000n, closeRateCap: 300000000000000n });
  });

  it("does not ask for the solver-fee caps on a v0.8.5 chain (no fetch to force for them)", async () => {
    await prepareInstantOpenParams(config, PARAMS);

    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeSolverFeeCaps: false }));
  });

  it("forwards pre-filled solver-fee caps from the market data to resolveMarket", async () => {
    await prepareInstantOpenParams(config, {
      ...PARAMS,
      market: { id: 1, minOpenSolverFeeCap: "0.001", minCloseSolverFeeCap: "0.002" },
    });

    expect(resolveMarket).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ minOpenSolverFeeCap: "0.001", minCloseSolverFeeCap: "0.002" }),
    );
  });

  it("omits solverFeeCaps entirely on a v0.8.5 chain", async () => {
    const result = await prepareInstantOpenParams(config, PARAMS);

    expect(result.solverFeeCaps).toBeUndefined();
  });

  it("falls back to the 1% default cap when a v0.8.6 resolver yields no cap strings", async () => {
    const result = await prepareInstantOpenParams(cappedConfig, PARAMS);

    /** 0.01 as an 18-decimal ratio. */
    expect(result.solverFeeCaps).toEqual({
      openRateCap: 10_000_000_000_000_000n,
      closeRateCap: 10_000_000_000_000_000n,
    });
  });

  it("throws INVALID_SOLVER_FEE_CAP on a malformed vendor cap string instead of signing zero caps", async () => {
    resolveMarket.mockResolvedValue({
      name: "BTCUSDT",
      pricePrecision: 2,
      quantityPrecision: 3,
      minOpenSolverFeeCap: "not-a-number",
      minCloseSolverFeeCap: "0.0003",
    });

    await expect(prepareInstantOpenParams(cappedConfig, PARAMS)).rejects.toThrow(
      /INVALID_SOLVER_FEE_CAP|not a valid decimal ratio/,
    );
  });

  it("leaves solverId undefined when the caller omits it, so the chain default applies", async () => {
    const result = await prepareInstantOpenParams(config, PARAMS);

    expect(result.solverId).toBeUndefined();
    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ solverId: undefined }));
  });

  it("skips the mark-price fetch when the caller supplies markPrice", async () => {
    await prepareInstantOpenParams(config, { ...PARAMS, markPrice: "100" });

    expect(resolveMarkPrice).toHaveBeenCalledWith(config, expect.objectContaining({ markPrice: "100" }));
  });

  it("validates the user slippage and gates the estimate with the sized order", async () => {
    fetchOpenEstimatePrice.mockResolvedValue("65000");

    await prepareInstantOpenParams(config, PARAMS);

    expect(assertValidSlippage).toHaveBeenCalledWith(1);
    // margin 100 × leverage 2 / mark 64790.2 → leveraged quantity 0.002
    expect(assertOpenEstimateWithinSlippage).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        symbolId: 1,
        quantity: "0.002",
        markPrice: "64790.2",
        slippage: 1,
        expectedFillPrice: "65000",
      }),
    );
  });

  it("uses a caller-supplied estimatedOpenPrice without fetching", async () => {
    await prepareInstantOpenParams(config, { ...PARAMS, estimatedOpenPrice: "65000" });

    expect(fetchOpenEstimatePrice).not.toHaveBeenCalled();
    expect(assertOpenEstimateWithinSlippage).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ expectedFillPrice: "65000" }),
    );
  });

  it("ignores estimatedOpenPrice and skips every estimate call on a non-lowcap solver", async () => {
    await prepareInstantOpenParams(config, { ...PARAMS, solverId: "rasa", estimatedOpenPrice: "65000" });

    expect(fetchOpenEstimatePrice).not.toHaveBeenCalled();
    expect(assertOpenEstimateWithinSlippage).not.toHaveBeenCalled();
  });

  it("requires slippage on a non-lowcap solver instead of auto-deriving", async () => {
    await expect(
      prepareInstantOpenParams(config, { ...PARAMS, solverId: "rasa", slippage: undefined }),
    ).rejects.toThrow(/SLIPPAGE_REQUIRED|slippage is required/);
    expect(deriveAutoSlippage).not.toHaveBeenCalled();
  });

  it("keeps majors margin at locks + platform fee — no solver fees, no hedger-fee resolution", async () => {
    resolveMarket.mockResolvedValue({
      name: "BTCUSDT",
      pricePrecision: 2,
      quantityPrecision: 3,
      hedgerFeeOpen: "0.001",
      hedgerFeeClose: "0.002",
    });

    const result = await prepareInstantOpenParams(config, { ...PARAMS, solverId: "rasa" });

    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeHedgerFees: false }));
    // locks only (platform fee is 0n in the fixture): notionalBasic = 0.001 × 65438.10 = 65.4381
    expect(result.margin?.amount).toBe(65_438_100_000_000_000_000n);
  });

  it("skips the gate when no usable estimate exists, instead of re-fetching inside it", async () => {
    fetchOpenEstimatePrice.mockResolvedValue(undefined);

    await prepareInstantOpenParams(config, PARAMS);

    expect(assertOpenEstimateWithinSlippage).not.toHaveBeenCalled();
  });

  it("propagates a rejection from the estimate gate instead of submitting", async () => {
    fetchOpenEstimatePrice.mockResolvedValue("70000");
    assertOpenEstimateWithinSlippage.mockRejectedValue(new Error("SLIPPAGE_EXCEEDED"));

    await expect(prepareInstantOpenParams(config, PARAMS)).rejects.toThrow("SLIPPAGE_EXCEEDED");
  });

  it("auto-derives slippage from the dry-run estimate when the caller omits it", async () => {
    const noSlippage = { ...PARAMS, slippage: undefined };
    fetchOpenEstimatePrice.mockResolvedValue("66000");
    deriveAutoSlippage.mockReturnValue(10);

    const result = await prepareInstantOpenParams(config, noSlippage);

    // Sized at mark before the estimate: quantity is slippage-independent.
    expect(fetchOpenEstimatePrice).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ symbolId: 1, quantity: "0.002", markPrice: "64790.2" }),
    );
    expect(deriveAutoSlippage).toHaveBeenCalledWith({
      markPrice: "64790.2",
      expectedFillPrice: "66000",
      positionType: PARAMS.positionType,
    });
    expect(assertValidSlippage).not.toHaveBeenCalled();
    // requestedOpenPrice = 64790.2 × 1.10 = 71269.22 at the derived 10%.
    expect(result.order.price).toBe(71_269_220_000_000_000_000_000n);
    // The gate reuses the already-fetched estimate at the derived tolerance.
    expect(assertOpenEstimateWithinSlippage).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ slippage: 10, expectedFillPrice: "66000" }),
    );
  });

  it("fetches the estimate once for settlement provisioning when the caller supplies slippage", async () => {
    fetchOpenEstimatePrice.mockResolvedValue("65000");

    await prepareInstantOpenParams(config, PARAMS);

    expect(fetchOpenEstimatePrice).toHaveBeenCalledTimes(1);
    expect(deriveAutoSlippage).not.toHaveBeenCalled();
    expect(assertValidSlippage).toHaveBeenCalledWith(1);
  });

  it("funds solver fees and expected settlement loss through the addMargin amount", async () => {
    resolveMarket.mockResolvedValue({
      name: "BTCUSDT",
      pricePrecision: 2,
      quantityPrecision: 3,
      hedgerFeeOpen: "0.001",
      hedgerFeeClose: "0.002",
    });
    fetchOpenEstimatePrice.mockResolvedValue("65000");

    const result = await prepareInstantOpenParams(config, PARAMS);

    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ includeHedgerFees: true }));
    // locks: notionalBasic = 0.001 × 65438.10 = 65.4381 → cva+lf+partyAmm = 65.4381
    // solver fees on notional 130.8762: open 0.1308762 + close 0.2617524
    // settlement loss (LONG): (65000 − 64790.2) × 0.002 = 0.4196
    // margin = 65.4381 + 0.1308762 + 0.2617524 + 0.4196 = 66.2503286
    expect(result.margin?.amount).toBe(66_250_328_600_000_000_000n);
  });
});
