import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains/supported-chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { ORDER_TYPE_LIMIT } from "../instant-close/shared/types";

const resolveMarket = vi.hoisted(() => vi.fn());
const resolveMarkPrice = vi.hoisted(() => vi.fn());

vi.mock("../shared/resolvers", () => ({ resolveMarket, resolveMarkPrice }));

import { prepareLimitCloseParams } from "./prepare-limit-close-params";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const FROM = "0x000000000000000000000000000000000000f200";
const PARTY_A = "0x0000000000000000000000000000000000005Ab1";

/** Base config: rasa declares `limitOrder`, enigma does not. */
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.BASE]: {
      addresses: { affiliatesAddress: AFFILIATE },
      defaultSolverId: "rasa",
      solvers: {
        enigma: {
          name: "Enigma",
          address: AFFILIATE,
          url: "https://enigma.test",
          notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "test" },
        },
        rasa: {
          name: "Rasa",
          address: AFFILIATE,
          url: "https://rasa.test",
          capabilities: { limitOrder: true },
        },
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
  price: "64790.2",
} as const;

describe("prepareLimitCloseParams", () => {
  beforeEach(() => {
    resolveMarket.mockReset().mockResolvedValue({ name: "BTCUSDT", pricePrecision: 2, quantityPrecision: 3 });
    // The real resolver short-circuits to a caller-supplied `markPrice`; mirror
    // that so passing the user's limit price as `markPrice` wins.
    resolveMarkPrice.mockReset().mockImplementation((_config, params) => Promise.resolve(params.markPrice ?? "999999"));
  });

  it("throws UNSUPPORTED_BY_SOLVER when the solver lacks limit support", async () => {
    await expect(prepareLimitCloseParams(config, { ...PARAMS, solverId: "enigma" })).rejects.toThrow(SymmError);
    expect(resolveMarket).not.toHaveBeenCalled();
  });

  it("tags the resolved close as LIMIT with a deadline", async () => {
    const result = await prepareLimitCloseParams(config, { ...PARAMS, solverId: "rasa" });

    expect(result.orderType).toBe(ORDER_TYPE_LIMIT);
    expect(result.order.quoteId).toBe(42n);
    expect(result.deadline).toBeGreaterThan(0n);
  });

  it("uses the user price as the close level with no slippage (ignores mark price)", async () => {
    const result = await prepareLimitCloseParams(config, { ...PARAMS, solverId: "rasa" });

    // 64790.2 → 18-decimal wei, unchanged (slippage 0). The mocked mark price (999999) is not used.
    expect(result.order.closePrice).toBe(64790_200000000000000000n);
  });
});
