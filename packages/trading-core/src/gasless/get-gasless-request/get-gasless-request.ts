import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessGet, resolveGaslessHttp } from "../http";
import type { GaslessRequest, GaslessService } from "../types";
import type { GaslessWireRequestRecord } from "../wire-types";
import { toGaslessRequest } from "./to-gasless-request";

/**
 * Parameters for {@link getGaslessRequest}.
 */
export type GetGaslessRequestParameters = Compute<
  ChainIdParameter & {
    /** Stable service tracking id returned by a gasless submit. */
    requestId: string;
    /**
     * Which sub-service stores the request. Operation relays live on
     * `"operations"` (the default); deposit settlements on `"deposits"`. The
     * two services are separate databases — a request id polled against the
     * wrong one is `NOT_FOUND`.
     */
    service?: GaslessService;
  }
>;

/** Return type of {@link getGaslessRequest}. */
export type GetGaslessRequestReturnType = GaslessRequest;

/**
 * Fetch one stored GaslessQ relayer request.
 *
 * Fire-and-forget model: a submit returns `202` immediately and this record is
 * the only source of truth afterwards. Poll it until
 * `isGaslessRequestTerminal(status)` — via the query factory's
 * `query.refetchInterval` in React, or {@link waitForGaslessRequest} in plain
 * code. `submitted` is **not** success; only `succeeded` is.
 *
 * @param config - The SDK config.
 * @param parameters - Request id, optional service and chain id.
 * @returns The normalized request record.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`
 *   when the chain has no usable gasless service.
 * @throws {SymmApiError} `GASLESS_STATUS_FETCH_FAILED` on HTTP failure —
 *   including `404` while the record is not yet readable right after a `202`
 *   (the accept-vs-record race; retry briefly before treating it as unknown).
 *
 * @example
 * ```ts
 * const request = await getGaslessRequest(config, { requestId });
 * if (request.status === GaslessRequestStatus.SUBMITTED) watchTx(request.txHash);
 * ```
 */
export async function getGaslessRequest(
  config: Config,
  parameters: GetGaslessRequestParameters,
): Promise<GetGaslessRequestReturnType> {
  const { chainId, requestId, service = "operations" } = parameters;
  const context = resolveGaslessHttp(config, { chainId, service });

  const raw = await gaslessGet<GaslessWireRequestRecord>(
    context,
    `/${encodeURIComponent(requestId)}`,
    "GASLESS_STATUS_FETCH_FAILED",
  );
  return toGaslessRequest(raw);
}
