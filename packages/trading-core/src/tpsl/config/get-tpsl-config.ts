import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { rethrowTpSlError } from "../internal/axios";
import { resolveTpSlConfig } from "../internal/resolve-tpsl-config";
import type { TpSlConfig } from "../types";
import { getConfigsV4ApiV5ConfigsGet } from "../types/generated/tpsl-handler";

/** Parameters for {@link getTpSlConfig}. */
export type GetTpSlConfigParameters = Compute<ChainIdParameter>;

/** Return type of {@link getTpSlConfig}. */
export type GetTpSlConfigReturnType = TpSlConfig;

/**
 * Fetch the handler's `/configs/` rules: `MinPriceDistancePercent` and
 * `MinProfitStopLossSpreadPercent`. Camel-cased on the SDK boundary.
 *
 * @throws {SymmError} when the chain has no `tpsl` config.
 * @throws {SymmApiError} when the HTTP request fails.
 */
export async function getTpSlConfig(config: Config, parameters: GetTpSlConfigParameters = {}): Promise<TpSlConfig> {
  const tpsl = resolveTpSlConfig(config, parameters.chainId);
  try {
    const response = await getConfigsV4ApiV5ConfigsGet({
      baseURL: tpsl.url,
      headers: { "App-Name": tpsl.appName, Accept: "application/json" },
    });
    return {
      minPriceDistancePercent: Number(response.data.MinPriceDistancePercent),
      minProfitStopLossSpreadPercent: Number(response.data.MinProfitStopLossSpreadPercent),
    };
  } catch (err) {
    return rethrowTpSlError(err, { code: "FETCH_TPSL_CONFIG_FAILED", baseURL: tpsl.url });
  }
}
