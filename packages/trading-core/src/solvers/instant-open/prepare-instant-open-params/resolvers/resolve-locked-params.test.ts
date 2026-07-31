import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../../core/chains/supported-chains";
import { createConfig } from "../../../../core/config";

const getGetLockedParamsSymbol = vi.hoisted(() => vi.fn());

vi.mock("../../../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../types/generated/enigma-solver")>();
  return { ...actual, getGetLockedParamsSymbol };
});

import { resolveLockedParams } from "./resolve-locked-params";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";

/**
 * A chain registering BOTH solver kinds. Both serve `/get_locked_params/{symbol}`
 * at the same path, so the only observable difference is the base URL — which is
 * exactly what a dropped `solverId` gets wrong.
 */
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

const LOCKED = { cva: "0.7", lf: "0.3", partyAmm: "99", partyBmm: "0" };

describe("resolveLockedParams", () => {
  beforeEach(() => {
    getGetLockedParamsSymbol.mockReset();
    getGetLockedParamsSymbol.mockResolvedValue({ data: LOCKED });
  });

  it("returns caller-supplied params without fetching when all four are provided", async () => {
    const result = await resolveLockedParams(config, {
      chainId: SymmioSupportedChainId.BASE,
      marketName: "BTCUSDT",
      leverage: 1,
      lockedParamPercent: LOCKED,
    });

    expect(result).toEqual(LOCKED);
    expect(getGetLockedParamsSymbol).not.toHaveBeenCalled();
  });

  it("reads the targeted solver, not the chain default", async () => {
    await resolveLockedParams(config, {
      chainId: SymmioSupportedChainId.BASE,
      solverId: "rasa",
      marketName: "BTCUSDT",
      leverage: 5,
    });

    expect(getGetLockedParamsSymbol).toHaveBeenCalledWith("BTCUSDT", { leverage: 5 }, { baseURL: "https://rasa.test" });
  });

  it("falls back to the chain's default solver when solverId is omitted", async () => {
    await resolveLockedParams(config, {
      chainId: SymmioSupportedChainId.BASE,
      marketName: "BTCUSDT",
      leverage: 5,
    });

    expect(getGetLockedParamsSymbol).toHaveBeenCalledWith(
      "BTCUSDT",
      { leverage: 5 },
      { baseURL: "https://enigma.test" },
    );
  });

  it("defaults missing percent fields to zero", async () => {
    getGetLockedParamsSymbol.mockResolvedValue({ data: { cva: "1" } });

    const result = await resolveLockedParams(config, {
      chainId: SymmioSupportedChainId.BASE,
      marketName: "BTCUSDT",
      leverage: 1,
    });

    expect(result).toEqual({ cva: "1", lf: "0", partyAmm: "0", partyBmm: "0" });
  });
});
