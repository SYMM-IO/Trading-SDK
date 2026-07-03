import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getGetLockedParamsSymbol, type ApiLockedParamsBySymbolIdResponse } from "../types/generated/enigma-solver";

/**
 * Parameters for {@link getLockedParams}.
 */
export type GetLockedParamsParameters = Compute<
  ChainIdParameter & {
    /** Solver market path value for `/get_locked_params/{symbol}`. */
    symbol: string;
    /** Leverage used by the solver to calculate locked percentages. */
    leverage: number;
  }
>;

/** Return type of {@link getLockedParams}: solver locked percentages. */
export type GetLockedParamsReturnType = ApiLockedParamsBySymbolIdResponse;

/**
 * Fetch locked params for a solver market and leverage from the chain's solver.
 *
 * @param config - The SDK config.
 * @param parameters - Market symbol/name, leverage, and optional chain id.
 * @returns Raw solver locked params (`cva`, `lf`, `partyAmm`, `partyBmm`, `leverage`).
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const locked = await getLockedParams(config, { symbol: "BTCUSDT", leverage: 5 });
 * console.log(locked.cva);
 * ```
 */
export async function getLockedParams(
  config: Config,
  parameters: GetLockedParamsParameters,
): Promise<GetLockedParamsReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  return fetchLockedParams(solver.url, parameters.symbol, parameters.leverage);
}

async function fetchLockedParams(
  baseURL: string,
  symbol: string,
  leverage: number,
): Promise<ApiLockedParamsBySymbolIdResponse> {
  try {
    const response = await getGetLockedParamsSymbol(symbol, { leverage }, { baseURL });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_LOCKED_PARAMS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_LOCKED_PARAMS_FAILED",
      `Failed to fetch locked params: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
