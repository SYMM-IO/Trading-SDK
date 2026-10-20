import { toFiniteNumber } from "@symmio/utils/number";
import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getNotionalCap } from "../types/generated/enigma-solver";
import { toEnigmaNotionalCap } from "./adapters";
import type { EnigmaNotionalCap } from "./types";

/**
 * Parameters for {@link getNotionalCapPage}.
 * Paging is optional; omit it for the first 100 rows. Totals cover only that page.
 * @example
 * const parameters: GetNotionalCapPageParameters = { chainId: 42161, limit: 50, offset: 100 };
 */
export type GetNotionalCapPageParameters = Compute<
  ReadSolverParameter & {
    /** Maximum rows in this page (1–100, default 100). */
    limit?: number;
    /** Zero-based row offset (default 0). */
    offset?: number;
  }
>;

/**
 * One page of normalized caps and its aggregate totals in float dollars.
 * Missing numeric wire fields are zero, matching the existing cap API.
 * @example
 * const page: GetNotionalCapPageReturnType = await getNotionalCapPage(config, { offset: 100 });
 * console.log(page.symbols, page.totalUsed);
 */
export interface GetNotionalCapPageReturnType {
  /** Number of symbols the solver returned. */
  count: number;
  /** Σ `openInterest` across this page (dollars). */
  totalOpenInterest: number;
  /** Σ `used` across this page (dollars). */
  totalUsed: number;
  /** Per-symbol rows. `/notional_cap` (list) is Enigma-only, so rows are always Enigma-shaped. */
  symbols: EnigmaNotionalCap[];
}

/**
 * Fetch one Enigma notional-cap page, with page-only totals in float dollars.
 * The live endpoint accepts at most 100 rows despite the generated spec's 500.
 * Missing numeric fields retain the existing zero fallback.
 * @param config - SDK configuration selecting the deployment.
 * @param parameters - Chain, solver and optional limit/offset.
 * @returns Normalized rows and totals for this page only.
 * @throws {SymmError} For invalid paging or an unsupported solver/chain.
 * @throws {SymmApiError} When the upstream request fails.
 * @example
 * ```ts
 * const page = await getNotionalCapPage(config, { limit: 100, offset: 100 });
 * console.log(page.totalUsed, page.symbols);
 * ```
 */
export async function getNotionalCapPage(
  config: Config,
  parameters: GetNotionalCapPageParameters = {},
): Promise<GetNotionalCapPageReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "enigma", "getNotionalCapPage");
  const limit = parameters.limit ?? 100;
  const offset = parameters.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new SymmError(
      "validation",
      "INVALID_NOTIONAL_CAP_PAGE",
      "limit must be an integer from 1 to 100 and offset a non-negative integer.",
    );
  }
  try {
    const response = await getNotionalCap({ limit, offset }, { baseURL: solver.url });
    const r = response.data as Record<string, unknown>;
    const rawSymbols = Array.isArray(r.symbols) ? (r.symbols as Parameters<typeof toEnigmaNotionalCap>[0][]) : [];
    return {
      count: toFiniteNumber(r.count as number | string | undefined),
      totalOpenInterest: toFiniteNumber(r.total_open_interest as number | string | undefined),
      totalUsed: toFiniteNumber(r.total_used as number | string | undefined),
      symbols: rawSymbols.map(toEnigmaNotionalCap),
    };
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_NOTIONAL_CAP_PAGE_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_NOTIONAL_CAP_PAGE_FAILED",
      `Failed to fetch notional caps: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
