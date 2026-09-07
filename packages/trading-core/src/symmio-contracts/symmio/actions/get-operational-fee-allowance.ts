import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { resolveGaslessService } from "../../../gasless/resolve-gasless";
import { SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

/**
 * Parameters for {@link getOperationalFeeAllowance}.
 */
export type GetOperationalFeeAllowanceParameters = Compute<
  ChainIdParameter & {
    /** The fee payer — the sub-account whose collateral the charger deducts from. */
    payer: Address;
    /**
     * The registered fee charger (the GaslessLayer proxy). Defaults to the
     * chain's `gasless.gaslessLayerAddress` when the chain has a gasless block.
     */
    charger?: Address;
  }
>;

/** Return type of {@link getOperationalFeeAllowance}. */
export interface GetOperationalFeeAllowanceReturnType {
  /** Current spendable allowance (raw collateral units). */
  allowance: bigint;
  /**
   * Allowance a pending reduction will lower to. Reductions are **delayed**
   * on-chain — the current `allowance` keeps applying until `reductionReadyAt`.
   */
  pendingAllowance: bigint;
  /** Unix timestamp (seconds) when the pending reduction takes effect; `0n` when none. */
  reductionReadyAt: bigint;
  /**
   * Fee multiplier for this `(payer, charger)` pair in basis points —
   * `10000n` is list price (the default when unset), below is a discount,
   * above a surcharge.
   */
  feeMultiplier: bigint;
}

/**
 * Read a payer's operational-fee allowance for a charger from the SYMMIO core
 * diamond.
 *
 * The gasless gateway charges its fee against this allowance atomically with
 * each relayed operation. `maxUint256` reads back as "unlimited"; a
 * never-approved pair reads `0n`.
 *
 * @param config - The SDK config.
 * @param parameters - Payer, optional charger override and chain id.
 * @returns The allowance tuple.
 * @throws {SymmError} `GASLESS_CHARGER_REQUIRED` when no `charger` is given and
 *   the chain has no gasless block to default from.
 * @throws Viem read errors.
 *
 * @example
 * ```ts
 * const { allowance } = await getOperationalFeeAllowance(config, { payer: subAccount });
 * ```
 */
export async function getOperationalFeeAllowance(
  config: Config,
  parameters: GetOperationalFeeAllowanceParameters,
): Promise<GetOperationalFeeAllowanceReturnType> {
  const { chainId, payer } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });
  const charger = parameters.charger ?? resolveDefaultCharger(config, chainId);

  const [allowance, pendingAllowance, reductionReadyAt, feeMultiplier] = await client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getOperationalFeeAllowance",
    args: [payer, charger],
  });

  return { allowance, pendingAllowance, reductionReadyAt, feeMultiplier };
}

function resolveDefaultCharger(config: Config, chainId: number | undefined): Address {
  try {
    return resolveGaslessService(config, { chainId }).gaslessLayerAddress;
  } catch {
    throw new SymmError(
      "validation",
      "GASLESS_CHARGER_REQUIRED",
      "getOperationalFeeAllowance: pass `charger` explicitly — the chain has no gasless block to default it from.",
    );
  }
}
