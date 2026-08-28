import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiDailyTradeVolumeResponse } from "../types/generated/enigma-solver";

const getTradeVolumeSymbolId = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getTradeVolumeSymbolId,
  };
});

import { getTradeVolume } from "./get-trade-volume";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const SAMPLE_RESPONSE: { data: ApiDailyTradeVolumeResponse[] } = {
  data: [
    { timestamp: "2026-07-09T00:00:00Z", volume: "448.699250908231105583" },
    { timestamp: "2026-07-10T00:00:00Z", volume: "98000" },
  ],
};

describe("getTradeVolume", () => {
  beforeEach(() => {
    getTradeVolumeSymbolId.mockReset();
  });

  it("passes the symbolId first and requests the config's solver base URL", async () => {
    getTradeVolumeSymbolId.mockResolvedValue(SAMPLE_RESPONSE);

    const volume = await getTradeVolume(config, { symbolId: 1 });

    expect(getTradeVolumeSymbolId).toHaveBeenCalledWith(1, expect.objectContaining({ baseURL: SOLVER_URL }));
    expect(volume).toEqual([
      { timestamp: "2026-07-09T00:00:00Z", volume: "448.699250908231105583" },
      { timestamp: "2026-07-10T00:00:00Z", volume: "98000" },
    ]);
  });

  it('defaults a missing volume to "0" and keeps the ISO timestamp', async () => {
    getTradeVolumeSymbolId.mockResolvedValue({ data: [{ timestamp: "2026-07-09T00:00:00Z" }] });

    const volume = await getTradeVolume(config, { symbolId: 1 });

    expect(volume).toEqual([{ timestamp: "2026-07-09T00:00:00Z", volume: "0" }]);
  });

  it("returns an empty array when the solver reports no rows", async () => {
    getTradeVolumeSymbolId.mockResolvedValue({ data: [] });
    expect(await getTradeVolume(config, { symbolId: 1 })).toEqual([]);
  });

  it("wraps request failures in a SymmError", async () => {
    getTradeVolumeSymbolId.mockRejectedValue(new Error("Network error"));
    await expect(getTradeVolume(config, { symbolId: 1 })).rejects.toBeInstanceOf(SymmError);
    await expect(getTradeVolume(config, { symbolId: 1 })).rejects.toThrow("Failed to fetch trade volume");
  });

  it("throws UNSUPPORTED_BY_SOLVER when the resolved solver is not enigma", async () => {
    await expect(getTradeVolume(config, { symbolId: 1, chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      code: "UNSUPPORTED_BY_SOLVER",
    });
    expect(getTradeVolumeSymbolId).not.toHaveBeenCalled();
  });
});
