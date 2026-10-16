import axios, { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { isExpressWithdrawOptionExpired } from "../is-express-withdraw-option-expired";
import { normalizeExpressWithdrawOptions } from "../normalize";
import { resolveExpressWithdrawService } from "../resolve-express-withdraw";
import type { ExpressWithdrawOptions, GetExpressWithdrawOptionsParameters } from "../types";
import type { ExpressWithdrawOptionsWire } from "../wire";

/**
 * Request signed withdrawal options from the configured Express service.
 *
 * @param config - SDK configuration.
 * @param parameters - Account, amount, receiver, optional affiliate/chain, and abort signal.
 * @returns Normalized non-expired options in service order.
 */
export async function getExpressWithdrawOptions(
  config: Config,
  parameters: GetExpressWithdrawOptionsParameters,
): Promise<ExpressWithdrawOptions> {
  const chain = config.getChainConfig(parameters.chainId);
  const service = resolveExpressWithdrawService(config, { chainId: parameters.chainId });
  const baseURL = service.url;

  try {
    const response = await axios.post<ExpressWithdrawOptionsWire>(
      "/options",
      {
        user: parameters.user,
        amount: parameters.amount.toString(),
        receiver: parameters.receiver,
        affiliate: parameters.affiliate ?? chain.addresses.affiliatesAddress,
      },
      { baseURL, signal: parameters.signal, headers: { "Content-Type": "application/json" } },
    );
    const normalized = normalizeExpressWithdrawOptions(response.data);
    return { ...normalized, options: normalized.options.filter((option) => !isExpressWithdrawOptionExpired(option)) };
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "GET_EXPRESS_WITHDRAW_OPTIONS_FAILED", baseURL });
    }
    throw new SymmError(
      "api",
      "GET_EXPRESS_WITHDRAW_OPTIONS_FAILED",
      `Express Withdraw options request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
