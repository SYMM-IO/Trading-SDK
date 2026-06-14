import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import {
  postInstantTradeInstantClose,
  type ApiV2InstantCloseRequest,
} from "../../types/generated/enigma-solver";

/**
 * Parameters for {@link sendInstantClose}.
 *
 * `operations` is the raw `ApiV2InstantCloseRequest.operations` array — one
 * entry per quote being closed. The endpoint accepts 1–100; this slice's
 * single-close primitive always sends `[op]` but the shared API stays
 * array-shaped so a future `bulkInstantClose` plugs in without changing the
 * hedger layer.
 */
export type SendInstantCloseParameters = Compute<
  ChainIdParameter & {
    /** Pre-signed `requestToClosePosition` payloads (1–100). */
    operations: ApiV2InstantCloseRequest["operations"];
  }
>;

/**
 * Result of {@link sendInstantClose}. The hedger endpoint returns no body
 * on success, so this is just a success ack.
 */
export interface SendInstantCloseReturnType {
  success: true;
}

/**
 * Submit a v2 instant close request to the chain's hedger.
 *
 * Wraps the orval-generated `postInstantTradeInstantClose` with the chain's
 * solver/hedger base URL and SDK error wrapping. The endpoint returns `void`
 * on success — we surface `{success: true}` to mirror the open flow's shape.
 *
 * @throws {SymmApiError} when the hedger request fails.
 * @throws {SymmError} when the chain is unsupported.
 */
export async function sendInstantClose(
  config: Config,
  parameters: SendInstantCloseParameters,
): Promise<SendInstantCloseReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  try {
    await postInstantTradeInstantClose({ operations: parameters.operations }, { baseURL: solver.url });
    return { success: true };
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, {
        code: "SEND_INSTANT_CLOSE_FAILED",
        baseURL: solver.url,
      });
    }

    throw new SymmError(
      "api",
      "SEND_INSTANT_CLOSE_FAILED",
      `Failed to send instant close: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
