import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getAccountBalanceInfo } from "../../symmio-contracts/account-layer/actions/get-account-balance-info";
import { getAccountBalanceOf } from "../../symmio-contracts/account-layer/actions/get-account-balance-of";
import { getGaslessBatchFeeQuote } from "../get-gasless-batch-fee-quote";
import { GaslessFeeSource } from "../types";
import type { GetGaslessBatchFundingParameters, GetGaslessBatchFundingReturnType } from "./types";

/**
 * Quote an exact batch and check each payer's projected Core fee funding.
 *
 * Fees are collected after operations. Supply any known Core balance movements
 * in `balanceChanges`; the action does not decode or simulate arbitrary calls.
 * Charges are grouped by their quoted payer, never pooled across accounts. The
 * comparison uses free plus allocated Core balances and includes native gas
 * collateral as well as fees. All amounts are internal 18-decimal units.
 *
 * This is advisory: allowances, payer selection and balances can change before
 * execution. It does not validate the operation's own spending/risk limits or
 * guarantee relay acceptance. Use a fresh read after reconciling pending work
 * and before a new submission; a cached preview is not a submission guard.
 *
 * @param config - SDK config; no wallet client is needed.
 * @param parameters - Exact relay account/calls, chain and known balance movements.
 * @returns The quote and independent coverage for every positively charged payer.
 * @throws {SymmError} `GASLESS_FUNDING_SOURCE_UNSUPPORTED` for non-Core fee sources,
 *   or `GASLESS_FUNDING_QUOTE_INCONSISTENT` for inconsistent/negative quoted debits.
 * @throws Quote errors, including `GASLESS_FREE_QUOTA_EXHAUSTED`, and balance-read errors unchanged.
 * @example
 * ```ts
 * const funding = await getGaslessBatchFunding(config, { account, calls });
 * if (!funding.hasSufficientBalance) showShortfalls(funding.payers);
 * ```
 */
export async function getGaslessBatchFunding(
  config: Config,
  parameters: GetGaslessBatchFundingParameters,
): Promise<GetGaslessBatchFundingReturnType> {
  const { chainId, account, calls, balanceChanges = [] } = parameters;
  const quote = await getGaslessBatchFeeQuote(config, { chainId, account, calls });
  const due = new Map<Address, bigint>();
  for (const payment of quote.payments) {
    if (payment.source !== GaslessFeeSource.SYMMIO_ACCOUNT) {
      throw new SymmError(
        "validation",
        "GASLESS_FUNDING_SOURCE_UNSUPPORTED",
        "Funding projections require SYMMIO account fee sources.",
      );
    }
    const components = [
      payment.operationalFee18,
      payment.depositFee18,
      payment.walletCreationFee18,
      payment.nativeTopUpFee18,
      payment.nativeGasCollateral18,
    ];
    if (components.some((amount) => amount < 0n)) {
      throw new SymmError("validation", "GASLESS_FUNDING_QUOTE_INCONSISTENT", "Quoted fee debits must be nonnegative.");
    }
    const payer = payment.payer.toLowerCase() as Address;
    due.set(payer, (due.get(payer) ?? 0n) + components.reduce((sum, amount) => sum + amount, 0n));
  }
  if ([...due.values()].reduce((sum, amount) => sum + amount, 0n) !== quote.totalDebit18) {
    throw new SymmError(
      "validation",
      "GASLESS_FUNDING_QUOTE_INCONSISTENT",
      "Quoted payer debits do not match the total debit.",
    );
  }
  const movements = new Map<Address, bigint>();
  for (const change of balanceChanges) {
    const payer = change.account.toLowerCase() as Address;
    movements.set(payer, (movements.get(payer) ?? 0n) + change.delta18);
  }
  const payers = await Promise.all(
    [...due]
      .filter(([, debit]) => debit > 0n)
      .map(async ([payer, debit18]) => {
        const [freeBalance18, info] = await Promise.all([
          getAccountBalanceOf(config, { chainId, account: payer }),
          getAccountBalanceInfo(config, { chainId, account: payer }),
        ]);
        const balanceBefore18 = freeBalance18 + info.allocatedBalance;
        const projected = balanceBefore18 + (movements.get(payer) ?? 0n);
        const projectedBalance18 = projected > 0n ? projected : 0n;
        return {
          payer,
          debit18,
          freeBalance18,
          balanceBefore18,
          projectedBalance18,
          shortfall18: debit18 > projectedBalance18 ? debit18 - projectedBalance18 : 0n,
        };
      }),
  );
  return { quote, hasSufficientBalance: payers.every((payer) => payer.shortfall18 === 0n), payers };
}
