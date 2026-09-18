import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getAccountBalanceOf, getSubAccount, SubAccountIsolationType } from "../../symmio-contracts/account-layer";
import { getWithdrawableTime } from "../../symmio-contracts/symmio";
import { getExpressWithdrawOptions } from "../get-express-withdraw-options";
import { supportsExpressWithdrawService } from "../resolve-express-withdraw";
import type { ExpressWithdrawOptionName, GetWithdrawRouteParameters, WithdrawRoute } from "../types";

const DEFAULT_OPTION_PRIORITY: readonly ExpressWithdrawOptionName[] = ["SAME_TX", "STANDARD"];

/**
 * Select the safest withdrawal route without submitting a transaction.
 *
 * @param config - SDK configuration.
 * @param parameters - Withdrawal intent and optional route policy.
 * @returns A classic or signed Express route ready for display/submission.
 */
export async function getWithdrawRoute(config: Config, parameters: GetWithdrawRouteParameters): Promise<WithdrawRoute> {
  const chainId = parameters.chainId ?? config.defaultChainId;
  const isolationType =
    parameters.isolationType ?? (await getSubAccount(config, { account: parameters.user, chainId })).isolationType;

  if (isolationType === SubAccountIsolationType.CUSTOM) {
    return { kind: "classic", finalize: "after-cooldown", reason: "unsupported-account" };
  }

  const [withdrawableTime, availableBalance] = await Promise.all([
    getWithdrawableTime(config, { user: parameters.user, chainId }),
    getAccountBalanceOf(config, { account: parameters.user, chainId }),
  ]);
  if (availableBalance >= parameters.amount && withdrawableTime <= BigInt(Math.floor(Date.now() / 1000))) {
    return { kind: "classic", finalize: "immediate", reason: "cooldown-ready" };
  }

  if (!supportsExpressWithdrawService(config, { chainId })) {
    if (parameters.policy?.fallback === "error") {
      throw new SymmError(
        "config",
        "EXPRESS_WITHDRAW_NOT_CONFIGURED",
        `Express Withdraw is not configured for chain ${chainId}.`,
      );
    }
    return { kind: "classic", finalize: "after-cooldown", reason: "service-disabled" };
  }

  let response;
  try {
    response = await getExpressWithdrawOptions(config, {
      user: parameters.user,
      amount: parameters.amount,
      receiver: parameters.receiver,
      affiliate: parameters.affiliate,
      chainId,
      signal: parameters.signal,
    });
  } catch (err) {
    if (parameters.policy?.fallback === "error") throw err;
    return { kind: "classic", finalize: "after-cooldown", reason: "service-error" };
  }

  const priority = parameters.policy?.optionPriority ?? DEFAULT_OPTION_PRIORITY;
  for (const optionName of priority) {
    const option = response.options.find((candidate) => candidate.optionTypeName === optionName);
    if (option) return { kind: "express", option };
  }

  if (parameters.policy?.fallback === "error") {
    throw new SymmError(
      "api",
      "EXPRESS_WITHDRAW_NO_ACCEPTABLE_OPTION",
      `Express Withdraw returned no option matching ${priority.join(", ")}.`,
    );
  }
  return { kind: "classic", finalize: "after-cooldown", reason: "no-option" };
}
