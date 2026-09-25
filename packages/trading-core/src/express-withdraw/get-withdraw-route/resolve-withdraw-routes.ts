import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getAccountBalanceOf, getSubAccount, SubAccountIsolationType } from "../../symmio-contracts/account-layer";
import { getWithdrawableTime } from "../../symmio-contracts/symmio";
import { getExpressWithdrawOptions } from "../get-express-withdraw-options";
import { supportsExpressWithdrawService } from "../resolve-express-withdraw";
import type {
  ExpressWithdrawOption,
  ExpressWithdrawOptionName,
  GetWithdrawRouteParameters,
  WithdrawRoute,
  WithdrawRouteChoice,
  WithdrawRouteChoices,
} from "../types";

const DEFAULT_OPTION_PRIORITY: readonly ExpressWithdrawOptionName[] = ["SAME_TX", "STANDARD"];

interface ResolveWithdrawRoutesOptions {
  includeAlternatives: boolean;
}

function expressChoices(options: readonly ExpressWithdrawOption[]): WithdrawRouteChoice[] {
  return options.map((option) => ({ kind: "express", option }));
}

function selectExpressRoute(
  options: readonly ExpressWithdrawOption[],
  priority: readonly ExpressWithdrawOptionName[],
): WithdrawRoute | undefined {
  for (const optionName of priority) {
    const option = options.find((candidate) => candidate.optionTypeName === optionName);
    if (option) return { kind: "express", option };
  }
  return undefined;
}

function choices(recommended: WithdrawRoute, available: readonly WithdrawRouteChoice[]): WithdrawRouteChoices {
  return { recommended, available };
}

/** Resolve automatic and optional alternative routes while preserving the legacy automatic policy. @internal */
export async function resolveWithdrawRoutes(
  config: Config,
  parameters: GetWithdrawRouteParameters,
  options: ResolveWithdrawRoutesOptions,
): Promise<WithdrawRouteChoices> {
  const chainId = parameters.chainId ?? config.defaultChainId;
  const isolationType =
    parameters.isolationType ?? (await getSubAccount(config, { account: parameters.user, chainId })).isolationType;

  if (isolationType === SubAccountIsolationType.CUSTOM) {
    const recommended = { kind: "classic", finalize: "after-cooldown", reason: "unsupported-account" } as const;
    return choices(recommended, [{ kind: "classic", finalize: "after-cooldown" }]);
  }

  const [withdrawableTime, availableBalance] = await Promise.all([
    getWithdrawableTime(config, { user: parameters.user, chainId }),
    getAccountBalanceOf(config, { account: parameters.user, chainId }),
  ]);
  const classicImmediate =
    availableBalance >= parameters.amount && withdrawableTime <= BigInt(Math.floor(Date.now() / 1000));
  const classicChoice = {
    kind: "classic",
    finalize: classicImmediate ? "immediate" : "after-cooldown",
  } as const;
  const immediateRoute = { kind: "classic", finalize: "immediate", reason: "cooldown-ready" } as const;

  if (classicImmediate && !options.includeAlternatives) {
    return choices(immediateRoute, [classicChoice]);
  }

  if (!supportsExpressWithdrawService(config, { chainId })) {
    if (!classicImmediate && parameters.policy?.fallback === "error") {
      throw new SymmError(
        "config",
        "EXPRESS_WITHDRAW_NOT_CONFIGURED",
        `Express Withdraw is not configured for chain ${chainId}.`,
      );
    }
    const recommended = classicImmediate
      ? immediateRoute
      : ({ kind: "classic", finalize: "after-cooldown", reason: "service-disabled" } as const);
    return choices(recommended, [classicChoice]);
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
    if (!classicImmediate && parameters.policy?.fallback === "error") throw err;
    const recommended = classicImmediate
      ? immediateRoute
      : ({ kind: "classic", finalize: "after-cooldown", reason: "service-error" } as const);
    return choices(recommended, [classicChoice]);
  }

  const available = [classicChoice, ...expressChoices(response.options)];
  if (classicImmediate) return choices(immediateRoute, available);

  const priority = parameters.policy?.optionPriority ?? DEFAULT_OPTION_PRIORITY;
  const expressRoute = selectExpressRoute(response.options, priority);
  if (expressRoute) return choices(expressRoute, available);

  if (parameters.policy?.fallback === "error") {
    throw new SymmError(
      "api",
      "EXPRESS_WITHDRAW_NO_ACCEPTABLE_OPTION",
      `Express Withdraw returned no option matching ${priority.join(", ")}.`,
    );
  }
  return choices({ kind: "classic", finalize: "after-cooldown", reason: "no-option" }, available);
}
