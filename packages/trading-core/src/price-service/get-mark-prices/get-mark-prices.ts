import { isAxiosError } from "axios";
import type { SymmioPriceServiceConfig } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { fetchBinanceMarkPrices } from "../adapters/binance-mark-prices";
import { fetchEnigmaMarkPrices } from "../adapters/enigma-mark-prices";
import { resolvePriceService } from "../resolve-price-service";
import type { MarkPriceTick } from "../types";

/**
 * Parameters for {@link getMarkPrices}.
 */
export type GetMarkPricesParameters = Compute<
  ReadSolverParameter & {
    /**
     * Market names to price. Omit to read every market the provider serves.
     *
     * Names the provider does not carry are simply absent from the result, so
     * the returned array may be shorter than `names` and is unordered relative
     * to it.
     */
    names?: readonly string[];
  }
>;

/** Return type of {@link getMarkPrices}: normalized ticks from the resolved provider. */
export type GetMarkPricesReturnType = MarkPriceTick[];

/**
 * Fetch a one-shot mark-price snapshot from whichever price provider serves the
 * resolved solver (`solver.priceService ?? chain.priceService`).
 *
 * Enigma reads its lowcap price service; Binance reads
 * `GET /fapi/v1/premiumIndex`. The provider is *derived* from
 * `{ chainId, solverId }` — it is never selected directly, because nothing in
 * the product picks a price source independently of the solver.
 *
 * **Name round-trip:** when `names` is supplied, each matched tick carries the
 * caller's exact spelling in `name`, so `ticks.find(t => t.name === yourName)`
 * always hits regardless of the provider's canonical casing.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain, solver, and name filter.
 * @returns Normalized mark-price ticks. Narrow on `provider` for provider-specific fields.
 * @throws {SymmApiError} when the provider request fails.
 * @throws {SymmError} `UNSUPPORTED_CHAIN` / `UNSUPPORTED_PRICE_SERVICE_TYPE`.
 *
 * @example
 * ```ts
 * const [btc] = await getMarkPrices(config, { solverId: "rasa", names: ["BTCUSDT"] });
 * if (btc?.provider === "binance") console.log(btc.indexPrice);
 * ```
 */
export async function getMarkPrices(
  config: Config,
  parameters: GetMarkPricesParameters = {},
): Promise<GetMarkPricesReturnType> {
  const priceService = resolvePriceService(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
  });

  try {
    return await fetchMarkPricesByProvider(priceService, parameters.names);
  } catch (err) {
    throw toMarkPricesError(err, priceService.url);
  }
}

/**
 * Dispatch to the resolved provider's adapter.
 *
 * Exhaustive: a new member of `SymmioPriceServiceType` fails to compile at the
 * `never` guard until its adapter is wired in here.
 *
 * @internal
 */
async function fetchMarkPricesByProvider(
  priceService: SymmioPriceServiceConfig,
  names?: readonly string[],
): Promise<MarkPriceTick[]> {
  switch (priceService.type) {
    case "enigma":
      return fetchEnigmaMarkPrices(priceService.url, names);
    case "binance":
      return fetchBinanceMarkPrices(priceService.url, names);
    default: {
      const unreachable: never = priceService.type;
      throw new SymmError(
        "config",
        "UNSUPPORTED_PRICE_SERVICE_TYPE",
        `Mark prices are not supported by price-service type "${unreachable}".`,
      );
    }
  }
}

/** @internal */
function toMarkPricesError(err: unknown, baseURL: string): SymmError {
  if (err instanceof SymmError) return err;
  if (isAxiosError(err)) return SymmApiError.fromAxios(err, { code: "FETCH_MARK_PRICES_FAILED", baseURL });
  return new SymmError(
    "api",
    "FETCH_MARK_PRICES_FAILED",
    `Failed to fetch mark prices: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err instanceof Error ? err : undefined },
  );
}
