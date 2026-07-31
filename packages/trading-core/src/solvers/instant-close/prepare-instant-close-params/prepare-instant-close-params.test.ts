import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { PositionType } from "../../../symmio-contracts/symmio/types";

const resolveMarket = vi.hoisted(() => vi.fn());
const resolveMarkPrice = vi.hoisted(() => vi.fn());

vi.mock("../../shared/resolvers", () => ({ resolveMarket, resolveMarkPrice }));

import { prepareInstantCloseParams } from "./prepare-instant-close-params";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const FROM = "0x000000000000000000000000000000000000f200";
const PARTY_A = "0x0000000000000000000000000000000000005Ab1";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.BASE]: {
      addresses: { affiliatesAddress: AFFILIATE },
      defaultSolverId: "enigma",
      solvers: {
        enigma: { name: "Enigma", address: AFFILIATE, url: "https://enigma.test" },
        rasa: { name: "Rasa", address: AFFILIATE, url: "https://rasa.test" },
      },
    },
  },
});

const PARAMS = {
  chainId: SymmioSupportedChainId.BASE,
  from: FROM,
  partyA: PARTY_A,
  quoteId: 42n,
  market: { id: 1 },
  positionType: PositionType.LONG,
  quantityToClose: "1",
  slippage: 1,
} as const;

describe("prepareInstantCloseParams", () => {
  beforeEach(() => {
    resolveMarket.mockReset().mockResolvedValue({ name: "BTCUSDT", pricePrecision: 2, quantityPrecision: 3 });
    resolveMarkPrice.mockReset().mockResolvedValue("64790.2");
  });

  it("forwards solverId to every solver-scoped resolver", async () => {
    await prepareInstantCloseParams(config, { ...PARAMS, solverId: "rasa" });

    expect(resolveMarket).toHaveBeenCalledWith(config, expect.objectContaining({ solverId: "rasa" }));
    expect(resolveMarkPrice).toHaveBeenCalledWith(config, expect.objectContaining({ solverId: "rasa" }));
  });

  /** `instantClose` resolves the submit URL from this field. */
  it("carries solverId into the returned InstantCloseParameters", async () => {
    const result = await prepareInstantCloseParams(config, { ...PARAMS, solverId: "rasa" });

    expect(result.solverId).toBe("rasa");
  });

  it("leaves solverId undefined when the caller omits it, so the chain default applies", async () => {
    const result = await prepareInstantCloseParams(config, PARAMS);

    expect(result.solverId).toBeUndefined();
  });
});
