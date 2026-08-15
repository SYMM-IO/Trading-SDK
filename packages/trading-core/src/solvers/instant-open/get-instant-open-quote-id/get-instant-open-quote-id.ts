import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import { getInstantQuoteIdTempQuoteId } from "../../types/generated/enigma-solver";

/**
 * Parameters for {@link getInstantOpenQuoteId}.
 */
export type GetInstantOpenQuoteIdParameters = Compute<
  ReadSolverParameter & {
    /** Hedger-local temp id (from a {@link GetInstantOpensReturnType} record). */
    tempQuoteId: number;
    /**
     * Hedger base URL to query. Defaults to the chain config's `solver.url`.
     */
    baseUrl?: string;
  }
>;

/** Return type of {@link getInstantOpenQuoteId}: the on-chain quote id, or `null`. */
export type GetInstantOpenQuoteIdReturnType = number | null;

/**
 * Resolve the on-chain quote id for a hedger temp id via the hedger's
 * `/instant_quote_id/{tempQuoteId}` endpoint.
 *
 * This is the reconciliation handoff: a pending instant-open carries a
 * hedger-local `tempQuoteId`; once the trade is anchored on-chain the hedger can
 * map it to the real quote id. Returns `null` while the mapping does not exist
 * yet (the trade is still off-chain only).
 *
 * @param config - The SDK config.
 * @param parameters - `tempQuoteId`, optional `chainId`, optional hedger `baseUrl`.
 * @returns The on-chain quote id, or `null` when not yet anchored.
 * @throws {SymmApiError} when the hedger request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const quoteId = await getInstantOpenQuoteId(config, { tempQuoteId: -1001 });
 * if (quoteId !== null) {
 *   // reconcile the optimistic record against on-chain quote `quoteId`
 * }
 * ```
 */
export async function getInstantOpenQuoteId(
  config: Config,
  parameters: GetInstantOpenQuoteIdParameters,
): Promise<GetInstantOpenQuoteIdReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  const baseURL = parameters.baseUrl ?? solver.url;
  try {
    const response = await getInstantQuoteIdTempQuoteId(parameters.tempQuoteId, { baseURL });
    return response.data?.quote_id ?? null;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "GET_INSTANT_OPEN_QUOTE_ID_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "GET_INSTANT_OPEN_QUOTE_ID_FAILED",
      `Failed to fetch instant-open quote id: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
