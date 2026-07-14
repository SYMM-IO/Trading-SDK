import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiFundingInfoResponse } from "../types/generated/enigma-solver";

const getGetFundingInfo = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getGetFundingInfo,
  };
});

import { getFundingInfo } from "./get-funding-info";

const SOLVER_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const SAMPLE_RESPONSE: { data: ApiFundingInfoResponse } = {
  data: {
    BTCUSDT: {
      funding_rate_epoch_duration: 43200,
      next_funding_rate_long: "0.0001",
      next_funding_rate_short: "-0.0002",
      next_funding_time: 1783209600000,
    },
  },
};

describe("getFundingInfo", () => {
  beforeEach(() => {
    getGetFundingInfo.mockReset();
  });

  it("requests the config's solver base URL and normalizes the market-keyed response", async () => {
    getGetFundingInfo.mockResolvedValue(SAMPLE_RESPONSE);

    const funding = await getFundingInfo(config, {});

    expect(getGetFundingInfo).toHaveBeenCalledWith(undefined, expect.objectContaining({ baseURL: SOLVER_URL }));
    expect(funding).toEqual([
      {
        symbol: "BTCUSDT",
        nextFundingRateLong: 0.0001,
        nextFundingRateShort: -0.0002,
        nextFundingTime: 1783209600000,
        epochDurationSeconds: 43200,
      },
    ]);
  });

  it("forwards a symbols filter to the solver", async () => {
    getGetFundingInfo.mockResolvedValue(SAMPLE_RESPONSE);

    await getFundingInfo(config, { symbols: ["BTCUSDT"] });

    expect(getGetFundingInfo).toHaveBeenCalledWith(
      { symbols: ["BTCUSDT"] },
      expect.objectContaining({ baseURL: SOLVER_URL }),
    );
  });

  it("returns an empty array when the solver reports no markets", async () => {
    getGetFundingInfo.mockResolvedValue({ data: {} });
    expect(await getFundingInfo(config, {})).toEqual([]);
  });

  it("wraps request failures in a SymmError", async () => {
    getGetFundingInfo.mockRejectedValue(new Error("Network error"));
    await expect(getFundingInfo(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(getFundingInfo(config, {})).rejects.toThrow("Failed to fetch funding info");
  });
});
