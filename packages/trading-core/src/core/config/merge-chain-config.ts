import type { DeepPartial } from "../../shared/types/properties";
import {
  getChainConfig,
  listSupportedChains,
  type SolverId,
  type SymmioChainConfig,
  type SymmioSolverConfig,
  type SymmioTpSlConfig,
} from "../chains";

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
 * known nested groups (`addresses`, `subgraphs`, `solvers`, `priceService`,
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
    solvers: mergeSolvers(base.solvers, override.solvers),
    defaultSolverId: override.defaultSolverId ?? base.defaultSolverId,
    priceService: { ...base.priceService, ...override.priceService },
    notifications: { ...base.notifications, ...override.notifications },
    muon: {
      /** `urls` is replaced wholesale when overridden, otherwise inherited from base. */
      urls: override.muon?.urls ?? base.muon.urls,
    },
  };
}

/**
 * Merge a per-chain solver map by id: each overridden solver is deep-merged onto
 * its base (or added when the id is new). Solvers the override does not mention
 * are inherited unchanged.
 */
function mergeSolvers(
  base: Partial<Record<SolverId, SymmioSolverConfig>>,
  override: DeepPartial<Record<SolverId, SymmioSolverConfig>> | undefined,
): Partial<Record<SolverId, SymmioSolverConfig>> {
  if (!override) return base;
  const merged: Partial<Record<SolverId, SymmioSolverConfig>> = { ...base };
  for (const [id, solverOverride] of Object.entries(override) as [SolverId, DeepPartial<SymmioSolverConfig>][]) {
    if (!solverOverride) continue;
    merged[id] = mergeSolver(base[id], solverOverride);
  }
  return merged;
}

/**
 * Merge one solver's fields. The optional nested `tpsl` block is deep-merged so a
 * partial override (e.g. only the `url`) keeps the base's other fields. When
 * neither base nor override declares `tpsl`, it stays absent.
 */
function mergeSolver(
  base: SymmioSolverConfig | undefined,
  override: DeepPartial<SymmioSolverConfig>,
): SymmioSolverConfig {
  const merged = { ...(base ?? {}), ...(override as Partial<SymmioSolverConfig>) } as SymmioSolverConfig;
  const overrideTpsl = override.tpsl;
  if (overrideTpsl) {
    merged.tpsl = {
      ...(base?.tpsl ?? ({} as SymmioTpSlConfig)),
      ...(overrideTpsl as Partial<SymmioTpSlConfig>),
    } as SymmioTpSlConfig;
  } else if (base?.tpsl) {
    merged.tpsl = base.tpsl;
  } else {
    delete merged.tpsl;
  }
  return merged;
}
