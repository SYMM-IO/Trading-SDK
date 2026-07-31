import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import { assertPriceServiceProvider } from "../../assert-price-service-provider";
import { resolvePriceService } from "../../resolve-price-service";
import { fetchBinancePing } from "../client";

/** Parameters for {@link getBinanceHealth}. */
export type GetBinanceHealthParameters = Compute<ReadSolverParameter>;

/** Return type of {@link getBinanceHealth}: `true` when the endpoint answered. */
export type GetBinanceHealthReturnType = boolean;

/**
 * Probe Binance USD-M Futures liveness (`GET /fapi/v1/ping`).
 *
 * The Binance twin of `getEnigmaPriceServiceHealth`. Resolves `true` on a 2xx
 * and **`false`** on any transport failure rather than throwing, so a health
 * indicator renders a state instead of tripping an error boundary — unreachable
 * *is* the answer. A misconfigured provider still throws: that is a config bug,
 * not a health signal.
 *
 * Mainly useful to separate "Binance is unreachable from this client"
 * (regional restriction, dead proxy, offline) from "this market has no price".
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and solver.
 * @returns `true` when the endpoint answered, `false` when it did not.
 * @throws {SymmError} `UNSUPPORTED_BY_PRICE_SERVICE` when the resolved provider is not Binance.
 */
export async function getBinanceHealth(
  config: Config,
  parameters: GetBinanceHealthParameters = {},
): Promise<GetBinanceHealthReturnType> {
  const priceService = resolvePriceService(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
  });
  assertPriceServiceProvider(priceService, "binance", "getBinanceHealth");

  try {
    return await fetchBinancePing(priceService.url);
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) return false;
    throw new SymmError(
      "api",
      "FETCH_BINANCE_HEALTH_FAILED",
      `Failed to probe Binance health: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
