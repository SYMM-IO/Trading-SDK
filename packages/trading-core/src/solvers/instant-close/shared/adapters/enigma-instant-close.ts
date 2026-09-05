import { postInstantTradeInstantClose, type ApiV2InstantCloseRequest } from "../../../types/generated/enigma-solver";
import type { SendInstantCloseReturnType } from "../hedger-api";
import { toSendInstantCloseError } from "./hedger-error";

/**
 * Submit pre-signed close operations to an **Enigma** (lowcap) hedger —
 * `POST /instant_trade/instant_close`, body `{ operations }`, empty `2xx` body
 * on success (normalized to `{ success: true }`).
 *
 * @param solverUrl - The resolved solver's base URL.
 * @param operations - Pre-signed `requestToClosePosition` payloads (1–100).
 * @throws {SymmApiError} when the hedger request fails.
 * @internal
 */
export async function sendEnigmaInstantClose(
  solverUrl: string,
  operations: ApiV2InstantCloseRequest["operations"],
): Promise<SendInstantCloseReturnType> {
  try {
    await postInstantTradeInstantClose({ operations }, { baseURL: solverUrl });
    return { success: true };
  } catch (err) {
    throw toSendInstantCloseError(err, solverUrl);
  }
}
