import { SymmError } from "../../shared/errors/symm-error";
import type { DeepPartial } from "../../shared/types/properties";
import {
  getChainConfig,
  listSupportedChains,
  type SolverId,
  type SymmioChainConfig,
  type SymmioNotificationsConfig,
  type SymmioPriceServiceConfig,
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
    solvers: mergeSolvers(base.chainId, base.solvers, override.solvers),
    defaultSolverId: override.defaultSolverId ?? base.defaultSolverId,
    priceService: mergePriceService(base.chainId, base.priceService, override.priceService),
    notifications: mergeNotifications(base.chainId, base.notifications, override.notifications),
    muon: {
      /** `urls` is replaced wholesale when overridden, otherwise inherited from base. */
      urls: override.muon?.urls ?? base.muon.urls,
    },
  };
}

/**
 * Merge a price-service override onto its base.
 *
 * A plain spread is wrong once more than one provider exists: an override that
 * switches `type` without restating both URLs would inherit the *previous*
 * provider's endpoints, pointing one provider's client at another's host. That
 * type-checks cleanly and fails at runtime as a confusing 404, so a `type` swap
 * is required to supply the whole block.
 *
 * A same-type (or type-less) override still merges field-by-field, so the common
 * `{ url, wsUrl }` staging override keeps working.
 *
 * @throws {SymmError} `PRICE_SERVICE_OVERRIDE_INCOMPLETE` when the override
 *   changes `type` but omits `url` or `wsUrl`.
 */
function mergePriceService(
  chainId: number,
  base: SymmioPriceServiceConfig,
  override: DeepPartial<SymmioPriceServiceConfig> | undefined,
): SymmioPriceServiceConfig {
  if (!override) return base;

  const merged = { ...base, ...override } as SymmioPriceServiceConfig;
  const swapsProvider = override.type !== undefined && override.type !== base.type;
  if (swapsProvider && (override.url === undefined || override.wsUrl === undefined)) {
    throw new SymmError(
      "config",
      "PRICE_SERVICE_OVERRIDE_INCOMPLETE",
      `createConfig: the priceService override for chain ${chainId} changes type from "${base.type}" to "${override.type}" but omits ${override.url === undefined ? "`url`" : "`wsUrl`"}. Supply both URLs when switching provider — inheriting the previous provider's endpoints would point the "${override.type}" client at "${base.type}" hosts.`,
    );
  }
  return merged;
}

/**
 * Merge a notifications override onto its base.
 *
 * Same trap as {@link mergePriceService}: once the config is a per-protocol
 * union, an override that switches `protocol` without restating the endpoint
 * would inherit the *previous* protocol's fields — a `rasa → enigma` swap
 * without a `channel` (or either swap without a `url`) type-checks as a
 * `DeepPartial` and fails at runtime. So a `protocol` swap must supply the
 * whole block; a same-protocol override still merges field-by-field.
 *
 * A swap takes the override block **alone** — nothing is inherited, including
 * the optional `searchUrl` (the previous protocol's REST search service does
 * not index the new protocol's stream).
 *
 * @throws {SymmError} `NOTIFICATIONS_OVERRIDE_INCOMPLETE` when the override
 *   changes `protocol` but omits `url`, or targets `enigma` without a
 *   `channel`.
 */
function mergeNotifications(
  chainId: number,
  base: SymmioNotificationsConfig,
  override: DeepPartial<SymmioNotificationsConfig> | undefined,
): SymmioNotificationsConfig {
  if (!override) return base;

  const swapsProtocol = override.protocol !== undefined && override.protocol !== base.protocol;
  if (swapsProtocol) {
    const missing =
      override.url === undefined
        ? "`url`"
        : override.protocol === "enigma" && (override as { channel?: string }).channel === undefined
          ? "`channel`"
          : null;
    if (missing) {
      throw new SymmError(
        "config",
        "NOTIFICATIONS_OVERRIDE_INCOMPLETE",
        `createConfig: the notifications override for chain ${chainId} changes protocol from "${base.protocol}" to "${override.protocol}" but omits ${missing}. Supply the whole block when switching protocol — inheriting the previous protocol's fields would point the "${override.protocol}" subscriber at "${base.protocol}" endpoints.`,
      );
    }
    return { ...override } as SymmioNotificationsConfig;
  }

  const merged = { ...base, ...override } as SymmioNotificationsConfig;
  if (merged.protocol === "rasa") {
    // A cast override could still sneak a `channel` key onto the rasa variant.
    delete (merged as { channel?: string }).channel;
  }
  return merged;
}

/**
 * Merge a per-chain solver map by id: each overridden solver is deep-merged onto
 * its base (or added when the id is new). Solvers the override does not mention
 * are inherited unchanged.
 */
function mergeSolvers(
  chainId: number,
  base: Partial<Record<SolverId, SymmioSolverConfig>>,
  override: DeepPartial<Record<SolverId, SymmioSolverConfig>> | undefined,
): Partial<Record<SolverId, SymmioSolverConfig>> {
  if (!override) return base;
  const merged: Partial<Record<SolverId, SymmioSolverConfig>> = { ...base };
  for (const [id, solverOverride] of Object.entries(override) as [SolverId, DeepPartial<SymmioSolverConfig>][]) {
    if (!solverOverride) continue;
    merged[id] = mergeSolver(chainId, base[id], solverOverride);
  }
  return merged;
}

/**
 * Merge one solver's fields. The optional nested `tpsl` and `priceService` blocks
 * are deep-merged so a partial override (e.g. only the `url`) keeps the base's
 * other fields. When neither base nor override declares a block, it stays absent
 * — for `priceService` that absence is meaningful: it is what makes the solver
 * fall back to the chain-level price service.
 */
function mergeSolver(
  chainId: number,
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

  const overridePriceService = override.priceService;
  if (overridePriceService) {
    // With no base block there is nothing to inherit, so the override must be
    // complete — route it through the same type-swap guard by treating it as a
    // swap away from the base (or chain) provider.
    merged.priceService = base?.priceService
      ? mergePriceService(chainId, base.priceService, overridePriceService)
      : assertCompletePriceService(chainId, overridePriceService);
  } else if (base?.priceService) {
    merged.priceService = base.priceService;
  } else {
    delete merged.priceService;
  }

  return merged;
}

/**
 * Validate a solver-nested price service that has no base to inherit from: every
 * field must be present, since there is nothing to fall back to.
 *
 * @throws {SymmError} `PRICE_SERVICE_OVERRIDE_INCOMPLETE`
 */
function assertCompletePriceService(
  chainId: number,
  override: DeepPartial<SymmioPriceServiceConfig>,
): SymmioPriceServiceConfig {
  if (override.type === undefined || override.url === undefined || override.wsUrl === undefined) {
    throw new SymmError(
      "config",
      "PRICE_SERVICE_OVERRIDE_INCOMPLETE",
      `createConfig: a solver-nested priceService on chain ${chainId} must declare \`type\`, \`url\` and \`wsUrl\` — there is no per-solver base to inherit the missing fields from. Omit the block entirely to fall back to the chain's price service.`,
    );
  }
  return override as SymmioPriceServiceConfig;
}
