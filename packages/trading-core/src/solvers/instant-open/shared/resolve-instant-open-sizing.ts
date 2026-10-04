import { toDecimal } from "@symmio/utils/decimal";
import { SymmError } from "../../../shared/errors/symm-error";
import type { FullBalanceFunding } from "../prepare-instant-open-params/prepare-instant-open-params";
import {
  computeInstantOpenCosts,
  sizeFullBalanceInstantOpen,
  type SizeFullBalanceInstantOpenParameters,
} from "./full-balance-sizing";
import type { CalculateTradeParamsReturnType } from "./trade-math";

/**
 * Validate the caller-supplied balance and typed margin without fetching data.
 * Use before requesting a fill estimate; preparation and fee preview also run
 * this check. An omitted availableBalance leaves existing funding behavior intact.
 *
 * @param parameters - Funding inputs and whether the selected solver supports lowcap opens.
 * @returns Nothing when the supplied balance funding is valid.
 * @throws {SymmError} INVALID_TRADE_PARAMETERS for invalid amounts or a margin above
 * the balance; AMBIGUOUS_FUNDING for fund plus availableBalance;
 * FULL_BALANCE_UNSUPPORTED for a non-lowcap solver with availableBalance.
 * @example
 * ```ts
 * validateInstantOpenBalanceFunding({ initialMargin: "100", availableBalance: "100", isLowcap: true });
 * ```
 */
export function validateInstantOpenBalanceFunding(parameters: {
  /** Explicit full-balance funding; cannot accompany availableBalance. */
  fund?: FullBalanceFunding;
  /** Typed initial margin as a decimal string; must not exceed availableBalance. */
  initialMargin?: string;
  /** Raw available collateral as a positive, finite decimal string. */
  availableBalance?: string;
  /** Whether the selected solver supports lowcap full-balance sizing. */
  isLowcap: boolean;
}): void {
  const { fund, availableBalance, isLowcap } = parameters;
  if (availableBalance === undefined) return;
  if (fund !== undefined) {
    throw new SymmError("validation", "AMBIGUOUS_FUNDING", "Pass availableBalance with initialMargin, not with fund.");
  }
  if (!isLowcap) {
    throw new SymmError("validation", "FULL_BALANCE_UNSUPPORTED", "Automatic full-balance funding is lowcap only.");
  }
  if (!isPositiveFiniteDecimal(availableBalance)) {
    throw new SymmError(
      "validation",
      "INVALID_TRADE_PARAMETERS",
      "availableBalance must be a positive finite decimal.",
    );
  }
  if (parameters.initialMargin !== undefined && !isPositiveFiniteDecimal(parameters.initialMargin)) {
    throw new SymmError("validation", "INVALID_TRADE_PARAMETERS", "initialMargin must be a positive finite decimal.");
  }
  if (parameters.initialMargin !== undefined && toDecimal(parameters.initialMargin).gt(availableBalance)) {
    throw new SymmError("validation", "INVALID_TRADE_PARAMETERS", "Initial margin exceeds available balance.");
  }
}

function isPositiveFiniteDecimal(value: string): boolean {
  try {
    const amount = toDecimal(value);
    return amount.isFinite() && amount.gt(0);
  } catch {
    return false;
  }
}

/** Resolve the effective trade and funding amount using the existing cost and full-balance formulas. */
export function resolveInstantOpenSizing(
  parameters: Omit<SizeFullBalanceInstantOpenParameters, "balance"> & {
    trade: CalculateTradeParamsReturnType;
    isLowcap: boolean;
    fund?: FullBalanceFunding;
    availableBalance?: string;
  },
) {
  const { trade, calculationInput, availableBalance, fund } = parameters;
  const costs = computeInstantOpenCosts({
    ...parameters,
    positionType: calculationInput.positionType,
    markPrice: calculationInput.markPrice,
    cvaPercent: calculationInput.cvaPercent,
    lfPercent: calculationInput.lfPercent,
    partyAmmPercent: calculationInput.partyAmmPercent,
  });
  const balance = fund?.balance ?? availableBalance;
  if (fund === undefined && availableBalance !== undefined) {
    if (!toDecimal(costs.marginAmount).isFinite()) {
      throw new SymmError("validation", "INVALID_TRADE_PARAMETERS", "Calculated funding must be finite.");
    }
  }
  if (balance !== undefined && (fund !== undefined || toDecimal(costs.marginAmount).gt(balance))) {
    const sized = sizeFullBalanceInstantOpen({ ...parameters, balance });
    return { ...sized, marginAmount: balance, fundingMode: "full-balance" as const };
  }
  return { trade, costs, marginAmount: costs.marginAmount, fundingMode: "initial-margin" as const };
}
