import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiFundingInfoResponse } from "../types/generated/enigma-solver";

const requestFundingInfo = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getFundingInfo: requestFundingInfo,
  };
});

import { getFundingInfo } from "./get-funding-info";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.ARBITRUM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

const SAMPLE_RESPONSE: { data: ApiFundingInfoResponse } = {
  data: {
    1: {
      funding_rate_epoch_duration: 43200,
      next_funding_rate_long: "0.0001",
      next_funding_rate_short: "-0.0002",
      next_funding_time: 1783209600000,
    },
  },
};

describe("getFundingInfo", () => {
  beforeEach(() => {
    requestFundingInfo.mockReset();
  });

  it("requests the config's solver base URL and normalizes the market-keyed response", async () => {
    requestFundingInfo.mockResolvedValue(SAMPLE_RESPONSE);

    const funding = await getFundingInfo(config, {});

    expect(requestFundingInfo).toHaveBeenCalledWith(undefined, expect.objectContaining({ baseURL: SOLVER_URL }));
    expect(funding).toEqual([
      {
        symbolId: 1,
        nextFundingRateLong: 0.0001,
        nextFundingRateShort: -0.0002,
        nextFundingTime: 1783209600000,
        epochDurationSeconds: 43200,
      },
    ]);
  });

  it("forwards a symbols filter to the solver", async () => {
    requestFundingInfo.mockResolvedValue(SAMPLE_RESPONSE);

    await getFundingInfo(config, { symbolIds: [1] });

    expect(requestFundingInfo).toHaveBeenCalledWith(
      { symbol_ids: [1] },
      expect.objectContaining({ baseURL: SOLVER_URL }),
    );
  });

  it("returns an empty array when the solver reports no markets", async () => {
    requestFundingInfo.mockResolvedValue({ data: {} });
    expect(await getFundingInfo(config, {})).toEqual([]);
  });

  it("wraps request failures in a SymmError", async () => {
    requestFundingInfo.mockRejectedValue(new Error("Network error"));
    await expect(getFundingInfo(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(getFundingInfo(config, {})).rejects.toThrow("Failed to fetch funding info");
  });
});
