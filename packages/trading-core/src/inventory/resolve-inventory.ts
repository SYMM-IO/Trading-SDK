import type { SymmioInventoryConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";

/**
 * Resolve a chain's inventory-service configuration.
 *
 * Optional per chain, so this throws rather than falling back to another chain's
 * deployment — reading a different system's TVL would surface as a wrong number,
 * not as an error.
 *
 * @param config - The SDK config.
 * @param chainId - Chain to resolve, or `undefined` for the config default.
 * @returns The chain's inventory-service configuration.
 * @throws {SymmError} `INVENTORY_NOT_CONFIGURED` when the chain has none.
 */
export function resolveInventoryService(config: Config, chainId?: number): SymmioInventoryConfig {
  const chainConfig = config.getChainConfig(chainId);
  const { inventory } = chainConfig;

  if (inventory === undefined) {
    throw new SymmError(
      "config",
      "INVENTORY_NOT_CONFIGURED",
      `Pools: chain ${chainConfig.chainId} has no inventory service configured. Set \`inventory.url\` for this chain in \`createConfig({ symmioConfig })\`.`,
    );
  }

  return inventory;
}

/**
 * Whether the chain has an inventory service configured — the non-throwing twin
 * of {@link resolveInventoryService}. Use it for `enabled` gates and UI.
 *
 * @param config - The SDK config.
 * @param chainId - Chain to check, or `undefined` for the config default.
 * @returns `true` when an inventory service is configured.
 */
export function supportsInventoryService(config: Config, chainId?: number): boolean {
  try {
    resolveInventoryService(config, chainId);
    return true;
  } catch {
    return false;
  }
}
