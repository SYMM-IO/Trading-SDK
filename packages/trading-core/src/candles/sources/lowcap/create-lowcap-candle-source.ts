import { hash } from "ohash";
import type { SolverId } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { assertPriceServiceProvider } from "../../../price-service/assert-price-service-provider";
import { resolvePriceService } from "../../../price-service/resolve-price-service";
import { SymmError } from "../../../shared/errors/symm-error";
import type { CandleSource } from "../../types";
import { createLowcapSymbolLoader } from "./create-lowcap-symbol-loader";
import { getLowcapCandles } from "./get-lowcap-candles";
import { getLowcapSupportedResolutions, toLowcapTimeframe } from "./map-resolution";
import { resolveLowcapSymbol } from "./resolve-lowcap-symbol";
import { watchLowcapCandles } from "./watch-lowcap-candles";

/** Options for {@link createLowcapCandleSource}. Endpoints come from the SDK config. */
export interface LowcapCandleSourceParameters {
  /** Target chain. Defaults to the config's default chain. */
  chainId?: number;
  /** Solver whose price service to use. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /** Include flat candles. Defaults to false; sent explicitly on every history request. */
  includeFlat?: boolean;
  /** Recent OHLCV reconciliation interval in milliseconds. Defaults to 30_000; minimum 1_000. */
  refreshIntervalMs?: number;
}

/**
 * Create a lowcap candle source backed by the configured public price service.
 *
 * Resolves full market names to symbol addresses, requests final-price OHLCV,
 * and reports quote volume in USD. Listings are reused for 60 seconds per source;
 * history is not cached. Empty windows do
 * not prove exhaustion: `noMoreData` is true only when the service confirms it.
 * Live prices form provisional candles; HTTP refreshes reconcile OHLCV.
 *
 * @param config - SDK configuration supplying matching REST and WebSocket endpoints.
 * @param parameters - Chain, solver, flat-candle policy, and refresh interval.
 * @returns A source for history hooks, stream hooks, and chart adapters.
 * @throws {SymmError} for invalid options. Unsupported deployments fail when a source method is called.
 * @example
 * ```ts
 * const source = createLowcapCandleSource(config);
 * const history = await source.getCandles({ marketName, resolution: "1h", from, to });
 * ```
 */
export function createLowcapCandleSource(config: Config, parameters: LowcapCandleSourceParameters = {}): CandleSource {
  const { chainId, solverId, includeFlat = false, refreshIntervalMs = 30_000 } = parameters;
  if (typeof includeFlat !== "boolean") {
    throw new SymmError("validation", "INVALID_ENIGMA_OHLCV_FLAT_ENABLE", "includeFlat must be true or false.");
  }
  if (!Number.isSafeInteger(refreshIntervalMs) || refreshIntervalMs < 1_000 || refreshIntervalMs > 2_147_483_647) {
    throw new SymmError(
      "validation",
      "INVALID_CANDLE_REFRESH_INTERVAL",
      "refreshIntervalMs must be an integer from 1000 to 2147483647.",
    );
  }

  function resolveService() {
    try {
      const value = resolvePriceService(config, { chainId, solverId });
      assertPriceServiceProvider(value, "enigma", "createLowcapCandleSource");
      return { value };
    } catch (error) {
      if (!(error instanceof SymmError) || error.kind !== "config") throw error;
      return { error };
    }
  }
  const resolved = resolveService();
  function requireService() {
    if (!resolved.value) throw resolved.error;
    return resolved.value;
  }
  let loadSymbols: ReturnType<typeof createLowcapSymbolLoader> | undefined;

  async function findSymbol(marketName: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    loadSymbols ??= createLowcapSymbolLoader(requireService().url);
    const symbols = await loadSymbols(signal);
    signal?.throwIfAborted();
    return resolveLowcapSymbol(symbols, marketName);
  }

  async function requireSymbol(marketName: string, signal?: AbortSignal) {
    const symbol = await findSymbol(marketName, signal);
    if (!symbol)
      throw new SymmError(
        "validation",
        "UNMAPPED_CANDLE_MARKET",
        `No lowcap market matches the full name "${marketName}".`,
      );
    return symbol;
  }

  return {
    id: `lowcap:${hash({
      ...(resolved.value
        ? { url: resolved.value.url, wsUrl: resolved.value.wsUrl }
        : { chainId: chainId ?? config.defaultChainId, solverId, error: resolved.error?.code }),
      includeFlat,
    })}`,
    priceBasis: "price-service",
    supportedResolutions: getLowcapSupportedResolutions(),
    maxCandlesPerRequest: 200,
    async getSymbol(marketName) {
      const symbol = await findSymbol(marketName);
      return symbol
        ? {
            marketName: symbol.name,
            sourceSymbol: symbol.address,
            description: symbol.name,
            pricePrecision: 8,
            volumePrecision: 2,
            volumeUnit: "quote",
            volumeCurrency: "USD",
          }
        : undefined;
    },
    async getCandles(request) {
      const symbol = await requireSymbol(request.marketName, request.signal);
      return getLowcapCandles({
        ...request,
        baseURL: requireService().url,
        symbolAddress: symbol.address,
        includeFlat,
      });
    },
    watchCandles(request) {
      const service = requireService();
      if (!toLowcapTimeframe(request.resolution)) {
        throw new SymmError(
          "validation",
          "UNSUPPORTED_CANDLE_RESOLUTION",
          `Unsupported lowcap resolution: ${request.resolution}.`,
        );
      }
      return watchLowcapCandles(config, {
        ...request,
        chainId,
        solverId,
        includeFlat,
        refreshIntervalMs,
        resolveAddress: async (signal) => (await requireSymbol(request.marketName, signal)).address,
        getHistory: (symbolAddress, range) =>
          getLowcapCandles({
            ...range,
            marketName: request.marketName,
            resolution: request.resolution,
            baseURL: service.url,
            symbolAddress,
            includeFlat,
          }),
      });
    },
  };
}
