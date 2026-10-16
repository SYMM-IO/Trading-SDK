import type { SymmioExpressWithdrawConfig } from "../core/chains";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";

/**
 * Resolve the Express Withdraw service configured for a chain.
 *
 * @param config - SDK configuration.
 * @param parameters - Optional chain override.
 * @returns The verified service URL and provider address.
 * @throws {SymmError} when the chain is not v0.8.6 or has no service configured.
 */
export function resolveExpressWithdrawService(
  config: Config,
  parameters: { chainId?: number } = {},
): SymmioExpressWithdrawConfig {
  const chain = config.getChainConfig(parameters.chainId);
  if (chain.contractsVersion !== "0.8.6") {
    throw new SymmError(
      "config",
      "EXPRESS_WITHDRAW_UNSUPPORTED_CONTRACTS",
      `Express Withdraw requires perps-core v0.8.6, but chain ${chain.chainId} uses ${chain.contractsVersion}.`,
    );
  }
  if (!chain.expressWithdraw) {
    throw new SymmError(
      "config",
      "EXPRESS_WITHDRAW_NOT_CONFIGURED",
      `Express Withdraw is not configured for chain ${chain.chainId}.`,
    );
  }
  return chain.expressWithdraw;
}

/**
 * Report whether a chain has a usable Express Withdraw deployment.
 *
 * @param config - SDK configuration.
 * @param parameters - Optional chain override.
 * @returns `true` only for v0.8.6 chains with a configured service/provider pair.
 */
export function supportsExpressWithdrawService(config: Config, parameters: { chainId?: number } = {}): boolean {
  try {
    resolveExpressWithdrawService(config, parameters);
    return true;
  } catch {
    return false;
  }
}
