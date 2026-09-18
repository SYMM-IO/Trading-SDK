import axios, { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { normalizeExpressWithdrawStatus } from "../normalize";
import { resolveExpressWithdrawService } from "../resolve-express-withdraw";
import type { ExpressWithdrawStatus, GetExpressWithdrawStatusParameters } from "../types";
import type { ExpressWithdrawStatusWire } from "../wire";

/**
 * Read service and provider progress for an Express withdrawal.
 *
 * @param config - SDK configuration.
 * @param parameters - Subaccount, request id, optional chain, and abort signal.
 * @returns Normalized local and on-chain state.
 */
export async function getExpressWithdrawStatus(
  config: Config,
  parameters: GetExpressWithdrawStatusParameters,
): Promise<ExpressWithdrawStatus> {
  const service = resolveExpressWithdrawService(config, { chainId: parameters.chainId });

  const baseURL = service.url;
  const path = `/status/${parameters.user}/${parameters.requestId.toString()}`;

  try {
    const response = await axios.get<ExpressWithdrawStatusWire>(path, { baseURL, signal: parameters.signal });
    return normalizeExpressWithdrawStatus(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "GET_EXPRESS_WITHDRAW_STATUS_FAILED", baseURL });
    }
    throw new SymmError(
      "api",
      "GET_EXPRESS_WITHDRAW_STATUS_FAILED",
      `Express Withdraw status request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
