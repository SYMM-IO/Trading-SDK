import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessGet, resolveGaslessHttp } from "../http";
import type { GaslessRequestTransaction, GaslessService } from "../types";
import type { GaslessWireTransactionAttempt } from "../wire-types";
import { toGaslessRequestTransaction } from "./to-gasless-request-transaction";

/**
 * Parameters for {@link getGaslessRequestTransactions}.
 */
export type GetGaslessRequestTransactionsParameters = Compute<
  ChainIdParameter & {
    /** Stable service tracking id returned by a gasless submit. */
    requestId: string;
    /** Which sub-service stores the request. Defaults to `"operations"`. */
    service?: GaslessService;
  }
>;

/** Return type of {@link getGaslessRequestTransactions}. */
export type GetGaslessRequestTransactionsReturnType = readonly GaslessRequestTransaction[];

/**
 * List the EVM broadcast attempts stored for one gasless request.
 *
 * A transaction hash is mutable across replacement attempts — the request id
 * is the stable identifier, and this endpoint shows every attempt with its
 * receipt outcome. Fetch it when a `txHash` appears or when a request reaches
 * a terminal status, to show explorer links or diagnose a `failed` request.
 *
 * @param config - The SDK config.
 * @param parameters - Request id, optional service and chain id.
 * @returns The stored attempts, oldest first as the service returns them.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmApiError} `GASLESS_TRANSACTIONS_FETCH_FAILED` on HTTP failure.
 *
 * @example
 * ```ts
 * const attempts = await getGaslessRequestTransactions(config, { requestId });
 * const latest = attempts.at(-1);
 * ```
 */
export async function getGaslessRequestTransactions(
  config: Config,
  parameters: GetGaslessRequestTransactionsParameters,
): Promise<GetGaslessRequestTransactionsReturnType> {
  const { chainId, requestId, service = "operations" } = parameters;
  const context = resolveGaslessHttp(config, { chainId, service });

  const raw = await gaslessGet<GaslessWireTransactionAttempt[]>(
    context,
    `/${encodeURIComponent(requestId)}/transactions`,
    "GASLESS_TRANSACTIONS_FETCH_FAILED",
  );
  return raw.map(toGaslessRequestTransaction);
}
