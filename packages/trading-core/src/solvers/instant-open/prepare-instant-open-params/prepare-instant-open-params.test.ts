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
