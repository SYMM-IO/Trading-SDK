import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { SymmioResolvedSolver, SymmioSolverKind } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { fetchEnigmaInstantOpens, fetchRasaInstantOpens } from "./adapters";
import type { NormalizedInstantOpenByKind, PendingInstantOpen } from "./types";

/**
 * Parameters for {@link getInstantOpens}, generic over the solver kind `K`.
 */
export type GetInstantOpensParameters<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  ChainIdParameter & {
    /** Which solver kind to read. Omit to use the chain's default solver. */
    solverId?: K;
    /** Sub-account (partyA) to read pending instant-open records for. */
    partyA: Address;
    /**
     * Hedger base URL to query. One call targets one hedger; fan out across
     * hedgers in the consumer.
     *
     * @deprecated Prefer `solverId` to select a configured solver; `baseUrl`
     * still wins when set. Defaults to the resolved solver's `url`.
     */
    baseUrl?: string;
  }
>;

/**
 * Return type of {@link getInstantOpens}: normalized {@link PendingInstantOpen}
 * records from one hedger. Both solver kinds map into the same unified shape, so
 * this is `readonly PendingInstantOpen[]` regardless of `K`.
 */
export type GetInstantOpensReturnType<K extends SymmioSolverKind = SymmioSolverKind> =
  readonly NormalizedInstantOpenByKind[K][];

/**
 * Fetch a sub-account's pending instant-open records from a single hedger's
 * `/instant_open/{account}` endpoint and normalize them to the unified
 * {@link PendingInstantOpen} shape — Enigma and Rasa responses share their
 * fields, so both map to one shape (Enigma's extra `uuid` is dropped).
 *
 * The hedger keeps returning a record until the corresponding quote exists
 * on-chain, at which point it drops from the response. One call targets one
 * hedger base URL; fan out across hedgers in the consumer.
 *
 * @param config - The SDK config.
 * @param parameters - `partyA`, optional `chainId`, `solverId`, hedger `baseUrl`.
 * @returns Normalized instant-open records for that hedger.
 * @throws {SymmApiError} when the hedger request fails.
 * @throws {SymmError} when the chain or solver is unsupported.
 *
 * @example
 * ```ts
 * const orders = await getInstantOpens(config, { partyA: "0xva…" });
 * ```
 */
export async function getInstantOpens<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  parameters: GetInstantOpensParameters<K>,
): Promise<GetInstantOpensReturnType<K>> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  const baseURL = parameters.baseUrl ?? solver.url;
  try {
    const records = await fetchInstantOpensBySolverKind(solver, baseURL, parameters.partyA);
    return records as GetInstantOpensReturnType<K>;
  } catch (err) {
    throw toInstantOpensError(err, baseURL);
  }
}

/**
 * Dispatch to the resolved solver's per-kind instant-opens adapter (each owns
 * its client call + normalization into {@link PendingInstantOpen}). Exhaustive
 * over the solver kinds — a new kind fails to compile at the `never` guard.
 *
 * @internal
 */
async function fetchInstantOpensBySolverKind(
  solver: SymmioResolvedSolver,
  baseURL: string,
  partyA: Address,
): Promise<readonly PendingInstantOpen[]> {
  switch (solver.id) {
    case "enigma":
      return fetchEnigmaInstantOpens(baseURL, partyA);
    case "rasa":
      return fetchRasaInstantOpens(baseURL, partyA);
    default: {
      const unreachable: never = solver.id;
      throw new SymmError(
        "api",
        "UNSUPPORTED_BY_SOLVER",
        `Instant opens are not supported by solver kind "${unreachable}".`,
      );
    }
  }
}

/**
 * Map a fetch failure to a typed {@link SymmError}.
 *
 * @internal
 */
function toInstantOpensError(err: unknown, baseURL: string): SymmError {
  if (err instanceof SymmError) return err;
  if (isAxiosError(err)) {
    return SymmApiError.fromAxios(err, { code: "GET_INSTANT_OPENS_FAILED", baseURL });
  }
  return new SymmError(
    "api",
    "GET_INSTANT_OPENS_FAILED",
    `Failed to fetch instant opens: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err instanceof Error ? err : undefined },
  );
}
