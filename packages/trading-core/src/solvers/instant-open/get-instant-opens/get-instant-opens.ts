import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { getInstantOpenAccountAddress } from "../../types/generated/enigma-solver";
import { toPendingInstantOpen, type PendingInstantOpen } from "./to-pending-instant-open";

/**
 * Parameters for {@link getInstantOpens}.
 */
export type GetInstantOpensParameters = Compute<
  ChainIdParameter & {
    /** Sub-account (partyA) to read pending instant-open records for. */
    partyA: Address;
    /**
     * Hedger base URL to query. One call targets one hedger; fan out across
     * hedgers in the consumer. Defaults to the chain config's `solver.url`.
     */
    baseUrl?: string;
  }
>;

/** Return type of {@link getInstantOpens}: normalized records from one hedger. */
export type GetInstantOpensReturnType = readonly PendingInstantOpen[];

/**
 * Fetch a sub-account's pending instant-open records from a single hedger's
 * `/instant_open/{account}` endpoint and normalize them to
 * {@link PendingInstantOpen}.
 *
 * The hedger keeps returning a record until the corresponding quote exists
 * on-chain, at which point it drops from the response. One call targets one
 * hedger base URL; fan out across hedgers in the consumer.
 *
 * @param config - The SDK config.
 * @param parameters - `partyA`, optional `chainId`, optional hedger `baseUrl`.
 * @returns Normalized instant-open records for that hedger.
 * @throws {SymmApiError} when the hedger request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const orders = await getInstantOpens(config, { partyA: "0xva…" });
 * ```
 */
export async function getInstantOpens(
  config: Config,
  parameters: GetInstantOpensParameters,
): Promise<GetInstantOpensReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  const baseURL = parameters.baseUrl ?? solver.url;
  try {
    const response = await getInstantOpenAccountAddress(parameters.partyA, { baseURL });
    return (response.data ?? []).map(toPendingInstantOpen);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "GET_INSTANT_OPENS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "GET_INSTANT_OPENS_FAILED",
      `Failed to fetch instant opens: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
