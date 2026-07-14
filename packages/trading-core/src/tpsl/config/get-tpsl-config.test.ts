import axios, { AxiosError, type AxiosResponse } from "axios";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getTpSlConfig } from "./get-tpsl-config";

const TPSL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.tpsl!;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

function okResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} } as AxiosResponse["config"],
  } as AxiosResponse<T>;
}

describe("getTpSlConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hits `/api/v5/configs/` with the `App-Name` header and camel-cases the response", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue(
      okResponse({
        MaxRequestTimeDeltaSeconds: 60,
        MinPriceDistancePercent: 1,
        MinProfitStopLossSpreadPercent: 2,
        MaxActiveOrdersPerUser: 20,
      }),
    );

    const result = await getTpSlConfig(config);

    expect(get).toHaveBeenCalledWith(
      "/api/v5/configs/",
      expect.objectContaining({
        baseURL: TPSL.url,
        headers: expect.objectContaining({ "App-Name": TPSL.appName }),
      }),
    );
    expect(result).toEqual({
      minPriceDistancePercent: 1,
      minProfitStopLossSpreadPercent: 2,
    });
  });

  it("wraps HTTP failures as SymmApiError via the SDK error hierarchy", async () => {
    const axiosErr = Object.assign(new AxiosError("boom"), { isAxiosError: true });
    vi.spyOn(axios, "get").mockRejectedValue(axiosErr);
    await expect(getTpSlConfig(config)).rejects.toMatchObject({
      code: "FETCH_TPSL_CONFIG_FAILED",
    });
  });
});
