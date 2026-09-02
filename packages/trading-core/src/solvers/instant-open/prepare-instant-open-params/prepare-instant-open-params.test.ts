import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { PositionType } from "../../../symmio-contracts/symmio/types";

const resolveMarket = vi.hoisted(() => vi.fn());
const resolveMarkPrice = vi.hoisted(() => vi.fn());
const resolveLockedParams = vi.hoisted(() => vi.fn());
const resolveFeeRates = vi.hoisted(() => vi.fn());

vi.mock("./resolvers", () => ({ resolveMarket, resolveMarkPrice, resolveLockedParams, resolveFeeRates }));

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
});
