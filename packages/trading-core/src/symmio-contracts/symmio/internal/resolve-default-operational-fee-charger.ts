import type { Address } from "viem";
import type { Config } from "../../../core/config";
import { resolveGaslessService } from "../../../gasless/resolve-gasless";
import { SymmError } from "../../../shared/errors/symm-error";

/**
 * The operational-fee charger an approval defaults to: the chain's
 * GaslessLayer proxy, which charges relayed operations.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id, and the calling action's name for the error message.
 * @returns The chain's `gasless.gaslessLayerAddress`.
 * @throws {SymmError} `GASLESS_CHARGER_REQUIRED` when the chain has no gasless block to default from.
 *
 * @internal
 */
export function resolveDefaultOperationalFeeCharger(
  config: Config,
  parameters: { chainId?: number; action: string },
): Address {
  try {
    return resolveGaslessService(config, { chainId: parameters.chainId }).gaslessLayerAddress;
  } catch {
    throw new SymmError(
      "validation",
      "GASLESS_CHARGER_REQUIRED",
      `${parameters.action}: pass \`chargers\` explicitly — the chain has no gasless block to default them from.`,
    );
  }
}
