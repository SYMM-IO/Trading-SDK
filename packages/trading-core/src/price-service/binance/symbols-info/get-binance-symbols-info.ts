import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import { assertPriceServiceProvider } from "../../assert-price-service-provider";
import { resolvePriceService } from "../../resolve-price-service";
import { fetchBinanceExchangeInfo } from "../client";
import type { BinanceExchangeSymbol } from "../types";

/** Parameters for {@link getBinanceSymbolsInfo}. */
export type GetBinanceSymbolsInfoParameters = Compute<ReadSolverParameter>;

/** Return type of {@link getBinanceSymbolsInfo}: every contract Binance lists. */
export type GetBinanceSymbolsInfoReturnType = BinanceExchangeSymbol[];

/**
 * Read Binance USD-M Futures `GET /fapi/v1/exchangeInfo` — the exchange's own
 * contract listing, with each symbol's status and price/quantity precision.
 *
 * The Binance twin of `getEnigmaPriceServiceSymbolsInfo`, and **reference data
 * only**. `getMarkets` remains the authority on which markets are tradable on
 * SYMMIO; this is what *Binance* lists, which is a superset and can disagree.
 * Use it to check whether a market has a price source at all, or to compare
 * Binance's precision against the solver's.
 *
 * **~1 MB response.** Cheap on request weight (1) but expensive to transfer and
 * parse, so cache it hard and never poll it — the query factory defaults to a
 * one-hour `staleTime` for that reason.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and solver.
 * @returns Every listed contract.
 * @throws {SymmError} `UNSUPPORTED_BY_PRICE_SERVICE` when the resolved provider is not Binance.
 * @throws {SymmApiError} `FETCH_BINANCE_SYMBOLS_INFO_FAILED` when the request fails.
 */
export async function getBinanceSymbolsInfo(
  config: Config,
  parameters: GetBinanceSymbolsInfoParameters = {},
): Promise<GetBinanceSymbolsInfoReturnType> {
  const priceService = resolvePriceService(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
  });
  assertPriceServiceProvider(priceService, "binance", "getBinanceSymbolsInfo");

  try {
    const info = await fetchBinanceExchangeInfo(priceService.url);
    return info.symbols ?? [];
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, {
        code: "FETCH_BINANCE_SYMBOLS_INFO_FAILED",
        baseURL: priceService.url,
      });
    }
    throw new SymmError(
      "api",
      "FETCH_BINANCE_SYMBOLS_INFO_FAILED",
      `Failed to fetch Binance exchange info: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
