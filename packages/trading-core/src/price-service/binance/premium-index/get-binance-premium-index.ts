import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import { fetchBinanceMarkPrices } from "../../adapters/binance-mark-prices";
import { assertPriceServiceProvider } from "../../assert-price-service-provider";
import { resolvePriceService } from "../../resolve-price-service";
import type { BinanceMarkPriceTick } from "../../types";

/**
 * Parameters for {@link getBinancePremiumIndex}.
 */
export type GetBinancePremiumIndexParameters = Compute<
  ReadSolverParameter & {
    /** Market names to price. Omit to read every symbol Binance lists. */
    names?: readonly string[];
  }
>;

/** Return type of {@link getBinancePremiumIndex}. */
export type GetBinancePremiumIndexReturnType = BinanceMarkPriceTick[];

/**
 * Read Binance USD-M Futures `GET /fapi/v1/premiumIndex` — mark price, index
 * price, and Binance's own funding fields.
 *
 * The provider-specific twin of {@link getMarkPrices}. Prefer the facade unless
 * you specifically want the Binance variant's fields without narrowing.
 *
 * The request form adapts to the input, because the endpoint has no
 * multi-symbol batch form:
 * - **exactly one name** → `?symbol=NAME`, measured request weight **1**;
 * - **many or no names** → the all-symbols form (weight **10**), filtered
 *   client-side.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain, solver, and name filter.
 * @returns Binance mark-price ticks. Unlisted names are absent, not an error.
 * @throws {SymmError} `UNSUPPORTED_BY_PRICE_SERVICE` when the resolved provider is not Binance.
 * @throws {SymmApiError} `FETCH_BINANCE_PREMIUM_INDEX_FAILED` when the request fails.
 *
 * @example
 * ```ts
 * const [btc] = await getBinancePremiumIndex(config, { solverId: "rasa", names: ["BTCUSDT"] });
 * console.log(btc?.indexPrice);
 * ```
 */
export async function getBinancePremiumIndex(
  config: Config,
  parameters: GetBinancePremiumIndexParameters = {},
): Promise<GetBinancePremiumIndexReturnType> {
  const priceService = resolvePriceService(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
  });
  assertPriceServiceProvider(priceService, "binance", "getBinancePremiumIndex");

  try {
    return await fetchBinanceMarkPrices(priceService.url, parameters.names);
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, {
        code: "FETCH_BINANCE_PREMIUM_INDEX_FAILED",
        baseURL: priceService.url,
      });
    }
    throw new SymmError(
      "api",
      "FETCH_BINANCE_PREMIUM_INDEX_FAILED",
      `Failed to fetch Binance premium index: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
