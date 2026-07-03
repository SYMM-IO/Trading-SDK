import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import {
  postInstantTradeInstantOpen,
  type ApiPostInstantOpenResponse,
  type ApiV2InstantOpenRequest,
} from "../../types/generated/enigma-solver";

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
  ChainIdParameter & {
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
  const { solver } = config.getChainConfig(parameters.chainId);
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
