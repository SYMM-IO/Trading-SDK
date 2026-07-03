import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { getInstantCloseAccountAddress } from "../../types/generated/enigma-solver";
import { toPendingInstantClose, type PendingInstantClose } from "./to-pending-instant-close";

/**
 * Parameters for {@link getInstantCloses}.
 */
export type GetInstantClosesParameters = Compute<
  ChainIdParameter & {
    /** Sub-account (partyA) to read pending instant-close records for. */
    partyA: Address;
    /**
     * Hedger base URL to query. One call targets one hedger; fan out across
     * hedgers in the consumer. Defaults to the chain config's `solver.url`.
     */
    baseUrl?: string;
  }
>;

/** Return type of {@link getInstantCloses}: normalized records from one hedger. */
export type GetInstantClosesReturnType = readonly PendingInstantClose[];

/**
 * Fetch a sub-account's pending instant-close records from a single hedger's
 * `/instant_close/{account}` endpoint and normalize them to
 * {@link PendingInstantClose}.
 *
 * The hedger keeps returning a record until the corresponding close request
 * settles on-chain, at which point it drops from the response. One call targets
 * one hedger base URL; fan out across hedgers in the consumer.
 *
 * @param config - The SDK config.
 * @param parameters - `partyA`, optional `chainId`, optional hedger `baseUrl`.
 * @returns Normalized instant-close records for that hedger.
 * @throws {SymmApiError} when the hedger request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const closes = await getInstantCloses(config, { partyA: "0xva…" });
 * ```
 */
export async function getInstantCloses(
  config: Config,
  parameters: GetInstantClosesParameters,
): Promise<GetInstantClosesReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  const baseURL = parameters.baseUrl ?? solver.url;
  try {
    const response = await getInstantCloseAccountAddress(parameters.partyA, { baseURL });
    return (response.data ?? []).map(toPendingInstantClose);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "GET_INSTANT_CLOSES_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "GET_INSTANT_CLOSES_FAILED",
      `Failed to fetch instant closes: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
