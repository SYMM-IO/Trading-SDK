import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../../shared/types/properties";
import {
  postInstantTradeInstantOpen,
  type ApiPostInstantOpenResponse,
  type ApiV2InstantOpenRequest,
} from "../../types/generated/enigma-solver";
import {
  instantRequestForQuoteWithSignatureInstantTradeOpenPost,
  type InstantRFQResponse,
  type InstantOperation as RasaInstantOperation,
} from "../../types/generated/rasa-solver";
import type { InstantOperationPayload } from "./types";

/**
 * Response shape from the hedger's `/instant_trade/instant_open` endpoint.
 *
 * Re-exported from the orval-generated client so consumers can read the raw
 * response without importing the generated module directly.
 */
export type SendInstantOpenReturnType = ApiPostInstantOpenResponse;

/**
 * Parameters for {@link sendInstantOpen}.
 */
export type SendInstantOpenParameters = Compute<
  ReadSolverParameter & {
    /** Pre-signed addMargin + sendQuote payloads (the orval `ApiV2InstantOpenRequest` shape). */
    request: ApiV2InstantOpenRequest;
  }
>;

/**
 * Submit a v2 instant open request to the chain's hedger.
 *
 * Wraps the orval-generated `postInstantTradeInstantOpen` with the chain's
 * solver/hedger base URL and SDK error wrapping.
 *
 * @throws {SymmApiError} when the hedger request fails.
 * @throws {SymmError} when the chain is unsupported.
 */
export async function sendInstantOpen(
  config: Config,
  parameters: SendInstantOpenParameters,
): Promise<SendInstantOpenReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  try {
    const response = await postInstantTradeInstantOpen(parameters.request, { baseURL: solver.url });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, {
        code: "SEND_INSTANT_OPEN_FAILED",
        baseURL: solver.url,
      });
    }

    throw new SymmError(
      "api",
      "SEND_INSTANT_OPEN_FAILED",
      `Failed to send instant open: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}

/**
 * Response shape from Rasa's `/instant_trade/open` endpoint — the accepted
 * request-for-quote, echoed back in full.
 */
export type SendRasaInstantOpenReturnType = InstantRFQResponse;

/**
 * Parameters for {@link sendRasaInstantOpen}.
 */
export type SendRasaInstantOpenParameters = Compute<
  ReadSolverParameter & {
    /** The pre-signed `sendQuote` payload. Rasa's flow has no `addMargin` leg. */
    sendQuote: InstantOperationPayload;
  }
>;

/**
 * Submit a v2 instant open request to a Rasa hedger.
 *
 * Rasa is cross-margin, so the request carries only `sendQuote` — its
 * `addMargin` field is optional and deliberately omitted.
 *
 * @remarks
 * Rasa's OpenAPI spec declares `SignedOperation` **without** `flexFields` /
 * `maxUses` and with a required `nonce`, which does not match what the service
 * actually accepts — the reference implementation posts the same full payload to
 * both solvers in production. The cast below bridges that stale spec; regenerate
 * the client and drop it once the vendor publishes a corrected schema.
 *
 * @throws {SymmApiError} when the hedger request fails.
 * @throws {SymmError} when the chain or solver is unsupported.
 */
export async function sendRasaInstantOpen(
  config: Config,
  parameters: SendRasaInstantOpenParameters,
): Promise<SendRasaInstantOpenReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  try {
    const response = await instantRequestForQuoteWithSignatureInstantTradeOpenPost(
      { sendQuote: parameters.sendQuote as unknown as RasaInstantOperation },
      { baseURL: solver.url },
    );
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, {
        code: "SEND_RASA_INSTANT_OPEN_FAILED",
        baseURL: solver.url,
      });
    }

    throw new SymmError(
      "api",
      "SEND_RASA_INSTANT_OPEN_FAILED",
      `Failed to send Rasa instant open: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
