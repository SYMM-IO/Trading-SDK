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
    /**
     * The fee payer — the account whose Core balance the charger draws from.
     * Read it for the account a fee quote names as `GaslessFeePayment.payer`: a
     * virtual account's operations normally bill its parent sub-account.
     */
    payer: Address;
    /**
     * The registered fee charger: the GaslessLayer **proxy**, not the relayer's
     * executor address. Defaults to the chain's `gasless.gaslessLayerAddress`
     * when the chain has a gasless block.
     */
    charger?: Address;
  }
>;

/**
 * Return type of {@link getOperationalFeeAllowance}. The amounts are
 * **18-decimal Core units** — the scale of the Core balance the fee is drawn
 * from, not the collateral token's decimals.
 */
export interface GetOperationalFeeAllowanceReturnType {
  /**
   * What the charger may still draw from the payer, in 18-decimal Core units.
   * Every charge decrements it — `maxUint256` included, so there is no
   * "unlimited" value. Compare it with 18-decimal fees, such as the fee-quote
   * payments that name this payer, or convert a token amount with
   * `collateralToCore18` first.
   */
  allowance: bigint;
  /**
   * The allowance a scheduled reduction will lower to, in 18-decimal Core
   * units. Only meaningful while `reductionReadyAt` is non-zero: until then the
   * current `allowance` keeps applying, and charges keep consuming it. When the
   * reduction takes effect the allowance becomes the lower of the two.
   */
  pendingAllowance: bigint;
  /**
   * Unix timestamp (seconds) when the scheduled reduction takes effect. `0n`
   * when none is pending — including once its time has passed, because the view
   * then already reports the reduced `allowance`.
   */
  reductionReadyAt: bigint;
  /**
   * Fee multiplier for this `(payer, charger)` pair in basis points. The
   * GaslessLayer scales this payer's selector fees by `feeMultiplier / 10000`:
   * `10000n` is list price (reported when unset), below is a discount, above a
   * surcharge. It does not scale a wallet creation fee.
   */
  feeMultiplier: bigint;
}

/**
 * Read a payer's operational-fee allowance for a charger from the SYMMIO core
 * diamond.
 *
 * The allowance caps what the GaslessLayer may charge the payer for relayed
 * operations. The fee is collected after the relayed batch executes, in the same
 * transaction, from the payer's Core balance (free balance first, then
 * allocated). The allowance only permits that charge — it adds no balance, so a
 * payer with allowance but too little Core balance still fails with
 * `OperationalFee: Insufficient balance`. A never-approved pair reads `0n`.
 *
 * Every amount is in **18-decimal Core units**. Read the allowance back after
 * approving and before submitting a relay.
 *
 * @param config - The SDK config.
 * @param parameters - Payer, optional charger override and chain id.
 * @returns The allowance tuple, in 18-decimal Core units.
 * @throws {SymmError} `GASLESS_CHARGER_REQUIRED` when no `charger` is given and
 *   the chain has no gasless block to default from.
 * @throws Viem read errors.
 *
 * @example
 * ```ts
 * const { allowance } = await getOperationalFeeAllowance(config, { payer: subAccount });
 * // Both 18-decimal Core units. The payer's Core balance must cover the fee too.
 * const allowanceCoversFee = allowance >= fee18;
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
