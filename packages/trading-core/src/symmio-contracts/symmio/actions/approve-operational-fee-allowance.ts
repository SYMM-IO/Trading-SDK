import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";
import { resolveDefaultOperationalFeeCharger } from "../internal/resolve-default-operational-fee-charger";

/**
 * Parameters for {@link approveOperationalFeeAllowance}: the same as
 * {@link approveOperationalFee}'s, without `feeMultipliers`.
 */
export type ApproveOperationalFeeAllowanceParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
      /**
       * The sub-account that pays operational fees. The call is routed through
       * the AccountLayer `_call` proxy so the diamond sees this sub-account as
       * `msg.sender` — the allowance is keyed by payer. The signer must be the
       * sub-account's `owner`, or a session key delegated this function's
       * selector when relayed.
       */
      account: Address;
      /**
       * The fee chargers to approve. Defaults to the chain's
       * `gasless.gaslessLayerAddress` — the GaslessLayer **proxy**, which is
       * the charger for relayed operations.
       */
      chargers?: readonly Address[];
      /**
       * Allowance per charger, parallel to `chargers`, in **18-decimal Core
       * units**. Each value **replaces** the current allowance, and every
       * charge decrements it. A raise applies immediately; a **reduction** can
       * be timelocked on-chain.
       */
      amounts: readonly bigint[];
    }
>;

/** Return type of {@link approveOperationalFeeAllowance}: the submitted transaction hash. */
export type ApproveOperationalFeeAllowanceReturnType = Hash;

/**
 * Set operational-fee allowances for the gasless fee charger, as the paying
 * sub-account, **without touching the fee multiplier** — the diamond's
 * two-argument `approveOperationalFee(chargers, amounts)`.
 *
 * Prefer {@link approveOperationalFee} by default; it also sets the charger's
 * fee multiplier (resetting it to list price when omitted). Reach for this one
 * when a multiplier set elsewhere must survive the approval, or when the signer
 * is a session key whose delegation holds only this function's selector —
 * relayed writes are checked per selector, and the two functions have
 * different ones.
 *
 * Amounts are **18-decimal Core units**, and each one replaces the current
 * allowance. Routed through the AccountLayer `_call` proxy, and relayable:
 * pass `gasless: true` (or run the chain in gasless execution mode) to have
 * the relayer submit it.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Paying sub-account, chargers and amounts, write options.
 * @returns The submitted transaction hash.
 * @throws {SymmError} `GASLESS_CHARGER_REQUIRED` when no `chargers` are given and
 *   the chain has no gasless block to default from.
 * @throws {SymmError} `OPERATIONAL_FEE_APPROVAL_MISMATCH` when the array lengths disagree.
 *
 * @example
 * ```ts
 * import { parseUnits } from "viem";
 *
 * // A bounded budget of 5 collateral tokens, signed by a session key that holds this selector.
 * const hash = await approveOperationalFeeAllowance(config, {
 *   account: subAccount,
 *   amounts: [parseUnits("5", 18)],
 *   from: sessionKey,
 *   gasless: true,
 * });
 * ```
 */
export async function approveOperationalFeeAllowance(
  config: Config,
  parameters: ApproveOperationalFeeAllowanceParameters,
): Promise<ApproveOperationalFeeAllowanceReturnType> {
  const { chainId, account, amounts } = parameters;

  const chargers = parameters.chargers ?? [
    resolveDefaultOperationalFeeCharger(config, { chainId, action: "approveOperationalFeeAllowance" }),
  ];

  if (chargers.length !== amounts.length) {
    throw new SymmError(
      "validation",
      "OPERATIONAL_FEE_APPROVAL_MISMATCH",
      `approveOperationalFeeAllowance: chargers (${chargers.length}) and amounts (${amounts.length}) must have the same length.`,
    );
  }

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "approveOperationalFee",
    args: [[...chargers], [...amounts]],
  });

  return callAsSubAccount(config, {
    account,
    data,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
    gasless: parameters.gasless,
  });
}
