import { SymmApiError } from "../../../../shared/errors/symm-error";
import type { ApiV2InstantCloseRequest } from "../../../types/generated/enigma-solver";
import {
  instantRequestToCloseWithSignatureInstantTradeClosePost,
  type InstantOperation as RasaInstantOperation,
} from "../../../types/generated/rasa-solver";
import type { SendInstantCloseReturnType } from "../hedger-api";
import { toSendInstantCloseError } from "./hedger-error";

/**
 * Submit pre-signed close operations to a **Rasa** (majors) hedger —
 * `POST /instant_trade/close`, body the bare operations array,
 * `{ successful, message }` on success. A `successful: false` status is a
 * logical rejection, surfaced as a {@link SymmApiError} carrying the hedger's
 * message.
 *
 * @remarks Rasa's OpenAPI spec declares `SignedOperation` without `flexFields` /
 * `maxUses`, which the service nonetheless accepts — the same stale-spec mismatch
 * the open flow bridges. The cast forwards the shared payload across.
 *
 * @param solverUrl - The resolved solver's base URL.
 * @param operations - Pre-signed `requestToClosePosition` payloads (1–100).
 * @throws {SymmApiError} when the hedger request fails or Rasa reports `successful: false`.
 * @internal
 */
export async function sendRasaInstantClose(
  solverUrl: string,
  operations: ApiV2InstantCloseRequest["operations"],
): Promise<SendInstantCloseReturnType> {
  try {
    const response = await instantRequestToCloseWithSignatureInstantTradeClosePost(
      operations as unknown as RasaInstantOperation[],
      { baseURL: solverUrl },
    );
    if (!response.data.successful) {
      const detail = response.data.message ? `: ${response.data.message}` : ".";
      throw new SymmApiError({
        code: "SEND_INSTANT_CLOSE_REJECTED",
        message: `Rasa hedger rejected the instant close${detail}`,
        status: response.status,
        statusText: response.statusText,
        responseData: response.data,
        url: `${solverUrl}/instant_trade/close`,
        method: "POST",
      });
    }
    return { success: true };
  } catch (err) {
    throw toSendInstantCloseError(err, solverUrl);
  }
}
