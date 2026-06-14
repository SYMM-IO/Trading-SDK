import type { DeepPartial } from "../../shared/types/properties";
import { getChainConfig, listSupportedChains, type SymmioChainConfig } from "../chains";

/**
 * Build the per-chain config registry a {@link Config} holds: every built-in
 * supported chain, deep-merged with the caller's overrides.
 *
 * @param overrides - Optional per-chain partial overrides keyed by chain id.
 * @returns A registry mapping chain id to its fully-resolved config.
 *
 * @internal
 */
export function buildChainConfigs(
  overrides?: Partial<Record<number, DeepPartial<SymmioChainConfig>>>,
): Record<number, SymmioChainConfig> {
  const registry: Record<number, SymmioChainConfig> = {};

  for (const chainId of listSupportedChains()) {
    const base = getChainConfig(chainId);
    const override = overrides?.[chainId];
    registry[chainId] = override ? mergeChainConfig(base, override) : base;
  }

  return registry;
}

/**
 * Deep-merge a single chain's overrides onto its built-in defaults. Only the
 * known nested groups (`addresses`, `subgraphs`, `solver`, `priceService`,
 * `notifications`, `muon`) are merged; unknown keys are ignored.
 *
 * @internal
 */
function mergeChainConfig(base: SymmioChainConfig, override: DeepPartial<SymmioChainConfig>): SymmioChainConfig {
  return {
    ...base,
    ...(override.chainId !== undefined ? { chainId: override.chainId } : {}),
    addresses: { ...base.addresses, ...override.addresses },
    subgraphs: { ...base.subgraphs, ...override.subgraphs },
    solver: { ...base.solver, ...override.solver },
    priceService: { ...base.priceService, ...override.priceService },
    notifications: { ...base.notifications, ...override.notifications },
    muon: {
      /** `urls` is replaced wholesale when overridden, otherwise inherited from base. */
      urls: override.muon?.urls ?? base.muon.urls,
    },
  };
}
