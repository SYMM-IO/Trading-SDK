import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getNotionalCapSymbolId } from "../types/generated/enigma-solver";
import { toMarketNotionalCap } from "./to-market-notional-cap";
import type { MarketNotionalCap } from "./types";

/**
 * Parameters for {@link getNotionalCapBySymbolId}.
 */
export type GetNotionalCapBySymbolIdParameters = Compute<
  ChainIdParameter & {
    /** Solver market id (`symbol_id`). */
    symbolId: number;
  }
>;

/** Return type of {@link getNotionalCapBySymbolId}. */
export type GetNotionalCapBySymbolIdReturnType = MarketNotionalCap;

/**
 * Fetch the solver's available liquidity (`available_to_long`,
 * `available_to_short`, …) for one market. Dollar amounts are returned as plain
 * `number` values, exactly as the solver reports them — no decimal scaling.
 *
 * Surfaces the solver-reported `error` string on the returned object instead of
 * throwing; HTTP / transport failures still throw {@link SymmApiError}.
 *
 * @param config - The SDK config.
 * @param parameters - Symbol id and optional chain id.
 * @returns The decoded {@link MarketNotionalCap}.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const cap = await getNotionalCapBySymbolId(config, { symbolId: 132 });
 * console.log(cap.availableToLong);
 * ```
 */
export async function getNotionalCapBySymbolId(
  config: Config,
  parameters: GetNotionalCapBySymbolIdParameters,
): Promise<GetNotionalCapBySymbolIdReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  try {
    const response = await getNotionalCapSymbolId(parameters.symbolId, { baseURL: solver.url });
    return toMarketNotionalCap(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_NOTIONAL_CAP_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_NOTIONAL_CAP_FAILED",
      `Failed to fetch notional cap: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
