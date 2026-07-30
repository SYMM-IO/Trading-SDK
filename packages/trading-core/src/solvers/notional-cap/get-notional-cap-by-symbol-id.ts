import { isAxiosError } from "axios";
import type { SymmioResolvedSolver, SymmioSolverKind } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchEnigmaNotionalCap, fetchRasaNotionalCap } from "./adapters";
import type { MarketNotionalCap, NormalizedNotionalCapByKind } from "./types";

/**
 * Parameters for {@link getNotionalCapBySymbolId}, generic over the solver kind
 * `K`. A **literal** `solverId` (`"rasa"`) narrows the return to that solver's
 * notional-cap type; a variable or omitted `solverId` yields the
 * {@link MarketNotionalCap} union.
 */
export type GetNotionalCapBySymbolIdParameters<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  ChainIdParameter & {
    /** Which solver kind to read. A literal narrows the return; omit for the chain's default. */
    solverId?: K;
    /** Solver market id (`symbol_id`). */
    symbolId: number;
  }
>;

/** Return type of {@link getNotionalCapBySymbolId}: the notional-cap type for kind `K` (the {@link MarketNotionalCap} union when unspecified). */
export type GetNotionalCapBySymbolIdReturnType<K extends SymmioSolverKind = SymmioSolverKind> =
  NormalizedNotionalCapByKind[K];

/**
 * Fetch the solver's available liquidity for one market, normalized to the
 * {@link MarketNotionalCap} union. The response shape diverges by solver kind —
 * Enigma returns the full breakdown (`availableToLong`, `openInterest`, …),
 * while Rasa returns only `totalCap` / `used` — so **narrow on `kind`** before
 * reading Enigma-only fields.
 *
 * Enigma surfaces its solver-reported `error` string on the returned object
 * instead of throwing; HTTP / transport failures still throw {@link SymmApiError}.
 *
 * @param config - The SDK config.
 * @param parameters - Symbol id, optional chain id and solver.
 * @returns The decoded {@link MarketNotionalCap}.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain or solver is unsupported.
 *
 * @example
 * ```ts
 * const cap = await getNotionalCapBySymbolId(config, { symbolId: 132 });
 * if (cap.kind === "enigma") console.log(cap.availableToLong);
 * else console.log(cap.totalCap, cap.used); // Rasa
 * ```
 */
export async function getNotionalCapBySymbolId<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  parameters: GetNotionalCapBySymbolIdParameters<K>,
): Promise<GetNotionalCapBySymbolIdReturnType<K>> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  try {
    const cap = await fetchNotionalCapBySolverKind(solver, parameters.symbolId);
    return cap as GetNotionalCapBySymbolIdReturnType<K>;
  } catch (err) {
    throw toNotionalCapError(err, solver.url);
  }
}

/**
 * Dispatch to the resolved solver's per-kind notional-cap adapter (each owns its
 * client call + normalization). Exhaustive over the solver kinds — a new kind
 * fails to compile at the `never` guard until its adapter is wired in.
 *
 * @internal
 */
async function fetchNotionalCapBySolverKind(
  solver: SymmioResolvedSolver,
  symbolId: number,
): Promise<MarketNotionalCap> {
  switch (solver.id) {
    case "enigma":
      return fetchEnigmaNotionalCap(solver.url, symbolId);
    case "rasa":
      return fetchRasaNotionalCap(solver.url, symbolId);
    default: {
      const unreachable: never = solver.id;
      throw new SymmError(
        "api",
        "UNSUPPORTED_BY_SOLVER",
        `Notional cap is not supported by solver kind "${unreachable}".`,
      );
    }
  }
}

/**
 * Map a fetch failure to a typed {@link SymmError}.
 *
 * @internal
 */
function toNotionalCapError(err: unknown, baseURL: string): SymmError {
  if (err instanceof SymmError) return err;
  if (isAxiosError(err)) {
    return SymmApiError.fromAxios(err, { code: "FETCH_NOTIONAL_CAP_FAILED", baseURL });
  }
  return new SymmError(
    "api",
    "FETCH_NOTIONAL_CAP_FAILED",
    `Failed to fetch notional cap: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err instanceof Error ? err : undefined },
  );
}
