import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getGaslessBatchFunding } from "../get-gasless-batch-funding/get-gasless-batch-funding";
import type { GetGaslessMarginFundingParameters, GetGaslessMarginFundingReturnType } from "./types";

/**
 * Project fee funding for one add/remove-margin action, including protected calls.
 *
 * Pass the exact relay `account` and `calls`, plus their matching margin context.
 * The SDK quotes those calls unchanged and projects the parent/VA transfer before
 * fee collection. It does not infer or validate that context from arbitrary
 * calldata; the caller must supply the actual parent and matching amount/direction.
 * Batches with additional Core balance movements require {@link getGaslessBatchFunding}
 * with all movements explicitly supplied instead.
 *
 * The result is advisory, not an execution simulation. A quote may change payers
 * at execution, so a shortfall can be conservative. Read again before a fresh
 * submission, after reconciling any previous request. No signing or submission
 * is performed and existing relay defaults remain unchanged.
 *
 * @param config - SDK config; no wallet client is needed.
 * @param parameters - Exact batch and its matching parent/VA margin context.
 * @returns Per-payer funding and a nullable fee-safe add bound.
 * @throws {SymmError} `GASLESS_MARGIN_FUNDING_INVALID` for invalid margin context.
 * @throws Funding, quote and balance-read errors unchanged.
 * @example
 * ```ts
 * const funding = await getGaslessMarginFunding(config, {
 *   account: parentAccount, parentAccount, virtualAccount, direction: "add", amount18,
 *   calls: [{ functionName: "addMargin", args: [virtualAccount, amount18] }],
 * });
 * if (!funding.hasSufficientBalance) showFundingChoices(funding);
 * ```
 */
export async function getGaslessMarginFunding(
  config: Config,
  parameters: GetGaslessMarginFundingParameters,
): Promise<GetGaslessMarginFundingReturnType> {
  const { chainId, account, calls, parentAccount, virtualAccount, direction, amount18 } = parameters;
  if (
    amount18 <= 0n ||
    parentAccount.toLowerCase() === virtualAccount.toLowerCase() ||
    (direction !== "add" && direction !== "remove")
  ) {
    throw new SymmError(
      "validation",
      "GASLESS_MARGIN_FUNDING_INVALID",
      "Margin funding requires a positive amount, distinct parent and virtual accounts, and an add/remove direction.",
    );
  }
  const adding = direction === "add";
  const funding = await getGaslessBatchFunding(config, {
    chainId,
    account,
    calls,
    balanceChanges: [
      { account: parentAccount, delta18: adding ? -amount18 : amount18 },
      { account: virtualAccount, delta18: adding ? amount18 : -amount18 },
    ],
  });
  const parent = funding.payers.find((payer) => payer.payer === parentAccount.toLowerCase() && payer.shortfall18 > 0n);
  let maxAddAmount18: bigint | null = null;
  if (adding && parent) {
    const afterFee = parent.balanceBefore18 - parent.debit18;
    maxAddAmount18 = afterFee < 0n ? 0n : afterFee < parent.freeBalance18 ? afterFee : parent.freeBalance18;
  }
  return { ...funding, maxAddAmount18 };
}
