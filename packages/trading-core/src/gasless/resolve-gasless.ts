import type { SymmioGaslessConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";

/**
 * Parameters for {@link resolveGaslessService} / {@link supportsGaslessService}.
 */
export interface ResolveGaslessServiceParameters {
  /** Target chain id. Defaults to the config's `defaultChainId`. */
  chainId?: number;
}

/**
 * Resolve the GaslessQ relayer service for a chain.
 *
 * Gasless is **chain-level**: a chain either carries a `gasless` block
 * ({@link SymmioGaslessConfig}) or it does not — no solver is involved. The
 * service additionally requires the perps-core contracts generation: the
 * relayer verifies operations against the GaslessLayer/InstantLayer pair that
 * only exists on `"0.8.6"` deployments, and backward compatibility with older
 * contracts is intentionally unsupported. Both conditions fail fast here with
 * a typed error, so a gasless action never signs a payload the gateway would
 * reject.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain override.
 * @returns The chain's {@link SymmioGaslessConfig}.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` when the chain has no gasless block.
 * @throws {SymmError} `GASLESS_UNSUPPORTED_CONTRACTS_VERSION` when the chain's
 *   `contractsVersion` is not `"0.8.6"`.
 *
 * @example
 * ```ts
 * const { url, gaslessLayerAddress } = resolveGaslessService(config, { chainId });
 * ```
 */
export function resolveGaslessService(
  config: Config,
  parameters: ResolveGaslessServiceParameters = {},
): SymmioGaslessConfig {
  const chain = config.getChainConfig(parameters.chainId);
  if (!chain.gasless) {
    throw new SymmError(
      "config",
      "GASLESS_NOT_CONFIGURED",
      `Gasless: chain ${chain.chainId} has no gasless relayer service configured.`,
    );
  }
  if (chain.contractsVersion !== "0.8.6") {
    throw new SymmError(
      "config",
      "GASLESS_UNSUPPORTED_CONTRACTS_VERSION",
      `Gasless: chain ${chain.chainId} runs contracts ${chain.contractsVersion}, but the gasless relayer supports only perps-core ("0.8.6") deployments.`,
    );
  }
  return chain.gasless;
}

/**
 * Whether the chain has a usable GaslessQ relayer service — the boolean twin of
 * {@link resolveGaslessService}. Non-throwing: returns `false` for a chain
 * without a gasless block, a non-perps-core chain, or an unknown chain. Use it
 * for `enabled` gates and UI so gasless features hide instead of erroring where
 * the relayer is unavailable.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain override.
 * @returns `true` when the chain has a usable gasless relayer configured.
 *
 * @example
 * ```ts
 * if (supportsGaslessService(config, { chainId })) showGaslessToggle();
 * ```
 */
export function supportsGaslessService(config: Config, parameters: ResolveGaslessServiceParameters = {}): boolean {
  try {
    resolveGaslessService(config, parameters);
    return true;
  } catch {
    return false;
  }
}
