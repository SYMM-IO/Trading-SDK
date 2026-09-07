import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import { resolveGaslessService } from "../../../gasless/resolve-gasless";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/**
 * Fee multiplier meaning "list price" (basis points). The default the diamond
 * applies when a pair has never set one.
 */
export const OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER = 10_000n;

/**
 * Parameters for {@link approveOperationalFee}.
 */
export type ApproveOperationalFeeParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
      /**
       * The sub-account that pays operational fees. The call is routed through
       * the AccountLayer `_call` proxy so the diamond sees this sub-account as
       * `msg.sender` — the allowance is keyed by payer, and a direct wallet call
       * would grant it from the wrong account. The connected wallet must be the
       * sub-account's `owner`.
       */
      account: Address;
      /**
       * The fee chargers to approve. Defaults to the chain's
       * `gasless.gaslessLayerAddress` (the one charger that exists today).
       */
      chargers?: readonly Address[];
      /**
       * Allowance per charger (raw collateral units, parallel to `chargers`).
       * Use `maxUint256` for "unlimited". **Reducing** an existing allowance is
       * delayed on-chain — the old value keeps applying until `reductionReadyAt`.
       */
      amounts: readonly bigint[];
      /**
       * Fee multiplier per charger in basis points; `10000n` = list price.
       * Defaults to {@link OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER} for every charger.
       */
      feeMultipliers?: readonly bigint[];
    }
>;

/** Return type of {@link approveOperationalFee}: the submitted transaction hash. */
export type ApproveOperationalFeeReturnType = Hash;

/**
 * Approve operational-fee allowances (`approveOperationalFeeWithMultiplier`)
 * for the gasless fee charger, as the paying sub-account.
 *
 * The gasless gateway can only charge a payer up to this allowance; grant it
 * **before** relying on gasless execution — when the relayer itself is down,
 * this wallet-paid path (via `AccountLayer._call`) is the only way to grant it.
 * The approval is also itself relayable: pass `gasless: true` once the
 * transparent gasless mode is active to have the relayer submit it.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Paying sub-account, chargers/amounts/multipliers, write options.
 * @returns The submitted transaction hash.
 * @throws {SymmError} `GASLESS_CHARGER_REQUIRED` when no `chargers` are given and
 *   the chain has no gasless block to default from.
 * @throws {SymmError} `OPERATIONAL_FEE_APPROVAL_MISMATCH` when the array lengths disagree.
 *
 * @example
 * ```ts
 * const hash = await approveOperationalFee(config, {
 *   account: subAccount,
 *   amounts: [maxUint256],
 * });
 * ```
 */
export async function approveOperationalFee(
  config: Config,
  parameters: ApproveOperationalFeeParameters,
): Promise<ApproveOperationalFeeReturnType> {
  const { chainId, account, amounts } = parameters;

  const chargers = parameters.chargers ?? [resolveDefaultCharger(config, chainId)];
  const feeMultipliers = parameters.feeMultipliers ?? chargers.map(() => OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER);

  if (chargers.length !== amounts.length || chargers.length !== feeMultipliers.length) {
    throw new SymmError(
      "validation",
      "OPERATIONAL_FEE_APPROVAL_MISMATCH",
      `approveOperationalFee: chargers (${chargers.length}), amounts (${amounts.length}) and feeMultipliers (${feeMultipliers.length}) must have the same length.`,
    );
  }

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "approveOperationalFeeWithMultiplier",
    args: [[...chargers], [...amounts], [...feeMultipliers]],
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

function resolveDefaultCharger(config: Config, chainId: number | undefined): Address {
  try {
    return resolveGaslessService(config, { chainId }).gaslessLayerAddress;
  } catch {
    throw new SymmError(
      "validation",
      "GASLESS_CHARGER_REQUIRED",
      "approveOperationalFee: pass `chargers` explicitly — the chain has no gasless block to default them from.",
    );
  }
}
