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
       * `gasless.gaslessLayerAddress` — the GaslessLayer **proxy**, which is
       * the charger for relayed operations. Never the relayer's executor
       * address.
       */
      chargers?: readonly Address[];
      /**
       * Allowance per charger, parallel to `chargers`, in **18-decimal Core
       * units** — the scale of the Core balance the fee is drawn from, not the
       * collateral token's decimals. `parseUnits("5", 18)` is a budget of 5
       * collateral tokens; `collateralToCore18` converts a token amount.
       *
       * Each value **replaces** the current allowance (ERC-20 `approve`
       * style, not an increment), and every charge decrements it. Choose a
       * bounded budget for the operations you intend to relay rather than
       * `maxUint256`. A raise applies immediately; a **reduction** can be
       * timelocked on-chain, in which case the old value keeps applying until
       * `reductionReadyAt`.
       */
      amounts: readonly bigint[];
      /**
       * Fee multiplier per charger in basis points; `10000n` = list price.
       * Defaults to {@link OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER} for every
       * charger. The call always sets the multiplier, so omitting this resets
       * a previously set one to list price.
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
 * The GaslessLayer proxy can only charge a payer up to this allowance, so grant
 * it **before** relying on gasless execution. When the relayer itself is down,
 * this wallet-paid path (via `AccountLayer._call`) is the only way to grant it.
 * The approval is also itself relayable: pass `gasless: true` once the
 * transparent gasless mode is active to have the relayer submit it.
 *
 * Amounts are **18-decimal Core units**. Approving only permits the charge — it
 * does not add collateral, and the fee is still drawn from the payer's Core
 * balance. Whatever its allowance, a payer short of balance fails with
 * `OperationalFee: Insufficient balance`. Read the allowance back with
 * `getOperationalFeeAllowance` after the transaction lands, before relying on it.
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
 * import { parseUnits } from "viem";
 *
 * // A bounded fee budget of 5 collateral tokens, in 18-decimal Core units.
 * const hash = await approveOperationalFee(config, {
 *   account: subAccount,
 *   amounts: [parseUnits("5", 18)],
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
