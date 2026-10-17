import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { getNotionalCapPage } from "./get-notional-cap-page";
import type { EnigmaNotionalCap } from "./types";

/**
 * Parameters for {@link getNotionalCapAll}.
 */
export type GetNotionalCapAllParameters = Compute<ReadSolverParameter>;

/** Return type of {@link getNotionalCapAll}: aggregate totals + per-symbol rows. */
export interface GetNotionalCapAllReturnType {
  /** Number of symbols the solver returned. */
  count: number;
  /** Σ `openInterest` across every market (dollars). */
  totalOpenInterest: number;
  /** Σ `used` across every market (dollars). */
  totalUsed: number;
  /** Per-symbol rows. `/notional_cap` (list) is Enigma-only, so rows are always Enigma-shaped. */
  symbols: EnigmaNotionalCap[];
}

/**
 * Fetch every Enigma notional-cap page in server order and sum page totals.
 * Dollar amounts remain plain numbers, with the existing zero fallback for
 * missing fields. A failed later page rejects the whole read.
 * @param config - SDK configuration selecting the deployment.
 * @param parameters - Optional chain and solver selection.
 * @returns All rows, their count and aggregate totals in float dollars.
 * @throws {SymmError} For an unsupported solver or chain.
 * @throws {SymmApiError} When any page request fails.
 * @example
 * ```ts
 * const caps = await getNotionalCapAll(config, {});
 * console.log(caps.count, caps.totalUsed);
 * ```
 */
export async function getNotionalCapAll(
  config: Config,
  parameters: GetNotionalCapAllParameters = {},
): Promise<GetNotionalCapAllReturnType> {
  const result: GetNotionalCapAllReturnType = { count: 0, totalOpenInterest: 0, totalUsed: 0, symbols: [] };
  // Live limit differs from the generated vendor spec. Do not raise it to 500.
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    let page: GetNotionalCapAllReturnType;
    try {
      page = await getNotionalCapPage(config, { ...parameters, limit: pageSize, offset });
    } catch (error) {
      // Preserve the bulk action's existing error code for transport failures.
      if (error instanceof SymmApiError && isAxiosError(error.cause)) {
        throw SymmApiError.fromAxios(error.cause, {
          code: "FETCH_NOTIONAL_CAP_ALL_FAILED",
          baseURL: config.getSolver(parameters).url,
        });
      }
      if (error instanceof SymmError && error.code === "FETCH_NOTIONAL_CAP_PAGE_FAILED") {
        throw new SymmError(error.kind, "FETCH_NOTIONAL_CAP_ALL_FAILED", error.message, { cause: error.cause });
      }
      throw error;
    }
    result.symbols.push(...page.symbols);
    result.totalOpenInterest += page.totalOpenInterest;
    result.totalUsed += page.totalUsed;
    if (page.symbols.length < pageSize) break;
  }
  result.count = result.symbols.length;
  return result;
}
