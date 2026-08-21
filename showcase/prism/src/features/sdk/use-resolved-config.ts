"use client";

import { DEPLOYMENTS, type Deployment } from "@/config/deployments";
import { symmioChains } from "@/config/symmio";
import { getChainConfig, type Config, type SymmioChainConfig } from "@symmio/trading-core";
import { useSymmioConfig } from "@symmio/trading-react";
import { useMemo } from "react";

/**
 * A solver exactly as the SDK resolves it — the registry entry plus its `id`.
 *
 * The SDK's own `SymmioResolvedSolver` is not re-exported from the package
 * root, so the type is recovered from `Config["getSolver"]` instead of being
 * restated here. Recovering it means this file cannot drift from the SDK.
 */
export type ResolvedSolver = ReturnType<Config["getSolver"]>;

/**
 * Where a live config value came from.
 *
 * `app` means the path appears in Prism's own `symmioChains` input; `registry`
 * means the SDK's built-in chain registry answered it and Prism never mentioned
 * it. The whole point of the SDK screen is how few paths are `app`.
 */
export type ConfigOrigin = "registry" | "app";

/** One deployment's live SDK configuration, with provenance attached. */
export interface ResolvedDeployment {
  /** The deployment this row describes. */
  deployment: Deployment;
  /** Fully merged chain config the SDK actually uses. Absent when resolution failed. */
  chain?: SymmioChainConfig;
  /** The solver `config.getSolver({ chainId, solverId })` returns. */
  solver?: ResolvedSolver;
  /** The same chain straight out of the SDK's built-in registry, before merging. */
  registry?: SymmioChainConfig;
  /** Dotted paths Prism's `symmioChains` input mentions at all. */
  supplied: ReadonlySet<string>;
  /** Dotted paths whose live value actually differs from the built-in registry. */
  changed: ReadonlySet<string>;
  /** Every leaf path in the merged chain config — the size of what the SDK answered. */
  fields: ReadonlySet<string>;
  /** Why resolution failed, when it did. A failed deployment never blanks the other. */
  error?: Error;
}

/**
 * Resolve every deployment's live SDK config, plus where each value came from.
 *
 * Nothing here is hardcoded: the live values come from the config the
 * `SymmioProvider` built, the built-in baseline comes from the SDK's exported
 * `getChainConfig`, and the provenance comes from walking Prism's own
 * `symmioChains` input. Diffing the three is what lets the screen claim
 * "the app supplied two addresses" and prove it.
 */
export function useResolvedDeployments(): readonly ResolvedDeployment[] {
  const config = useSymmioConfig();

  return useMemo(() => DEPLOYMENTS.map((deployment) => resolveDeployment(config, deployment)), [config]);
}

function resolveDeployment(config: Config, deployment: Deployment): ResolvedDeployment {
  const supplied = new Set<string>();
  collectPaths(symmioChains[deployment.chainId], "", supplied);

  try {
    const chain = config.getChainConfig(deployment.chainId);
    const solver = config.getSolver({ chainId: deployment.chainId, solverId: deployment.solverId });
    const registry = getChainConfig(deployment.chainId);

    const changed = new Set<string>();
    collectDifferences(chain, registry, "", changed);

    const fields = new Set<string>();
    collectPaths(chain, "", fields);

    return { deployment, chain, solver, registry, supplied, changed, fields };
  } catch (error) {
    return {
      deployment,
      supplied,
      changed: new Set<string>(),
      fields: new Set<string>(),
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/** Whether Prism's own config input mentions this path. */
export function originOf(resolved: ResolvedDeployment, path: string): ConfigOrigin {
  return resolved.supplied.has(path) ? "app" : "registry";
}

/**
 * Whether the live value at a path differs from the SDK's built-in default.
 *
 * Distinct from {@link originOf} on purpose: Prism *supplies* both affiliate
 * addresses because `createConfig` throws `AFFILIATE_ADDRESS_REQUIRED` without
 * them, yet the values it supplies happen to equal the registry's. Saying
 * "overridden" there would be a lie, so the screen says "supplied" and notes
 * separately when a value truly diverges.
 */
export function isChanged(resolved: ResolvedDeployment, path: string): boolean {
  return resolved.changed.has(path);
}

/** Dotted path of a field on this deployment's solver, e.g. `solvers.rasa.url`. */
export function solverPath(resolved: ResolvedDeployment, field: string): string {
  return `solvers.${resolved.deployment.solverId}.${field}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Flatten an object to the dotted leaf paths it mentions. */
function collectPaths(value: unknown, prefix: string, out: Set<string>): void {
  if (!isRecord(value)) {
    if (prefix) out.add(prefix);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    collectPaths(child, prefix ? `${prefix}.${key}` : key, out);
  }
}

/** Flatten the leaf paths where two configs disagree. */
function collectDifferences(live: unknown, base: unknown, prefix: string, out: Set<string>): void {
  if (isRecord(live) && isRecord(base)) {
    for (const key of new Set([...Object.keys(live), ...Object.keys(base)])) {
      collectDifferences(live[key], base[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  if (prefix && JSON.stringify(live) !== JSON.stringify(base)) out.add(prefix);
}
