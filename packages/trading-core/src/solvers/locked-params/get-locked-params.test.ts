import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiLockedParamsBySymbolIdResponse } from "../types/generated/enigma-solver";

const getGetLockedParamsSymbol = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getGetLockedParamsSymbol,
  };
});

import { getLockedParams } from "./get-locked-params";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});
const SAMPLE_RESPONSE: { data: ApiLockedParamsBySymbolIdResponse } = {
  data: {
    cva: "0.02",
    lf: "0.01",
    partyAmm: "0.03",
    partyBmm: "0.03",
    leverage: "5",
  },
};

describe("getLockedParams", () => {
  beforeEach(() => {
    getGetLockedParamsSymbol.mockReset();
  });

  it("requests the config's solver base URL and returns locked params", async () => {
    getGetLockedParamsSymbol.mockResolvedValue(SAMPLE_RESPONSE);

    const lockedParams = await getLockedParams(config, { symbol: "BTCUSDT", leverage: 5 });

    expect(getGetLockedParamsSymbol).toHaveBeenCalledWith("BTCUSDT", { leverage: 5 }, { baseURL: SOLVER_URL });
    expect(lockedParams).toEqual(SAMPLE_RESPONSE.data);
  });

  it("wraps request failures in a SymmError", async () => {
    getGetLockedParamsSymbol.mockRejectedValue(new Error("Network error"));
    await expect(getLockedParams(config, { symbol: "BTCUSDT", leverage: 5 })).rejects.toBeInstanceOf(SymmError);
    await expect(getLockedParams(config, { symbol: "BTCUSDT", leverage: 5 })).rejects.toThrow(
      "Failed to fetch locked params",
    );
  });
});
