"use client";

import { DEPLOYMENTS, type Deployment } from "@/config/deployments";
import { usePrismMode } from "@/features/mode/mode-provider";
import type { Config } from "@symmio/trading-core";
import { useSymmioConfig } from "@symmio/trading-react";
import { useQueries, type UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * The subset of TanStack query options the fan-out needs.
 *
 * Deliberately structural: every `getXQueryOptions` factory the SDK ships
 * satisfies it, and widening the data type to `T` here keeps the per-slice
 * generics out of the call sites.
 */
export type DeploymentQueryOptions<T> = {
  queryKey: readonly unknown[];
  queryFn: (...args: never[]) => Promise<T>;
  /**
   * Passed straight through to TanStack, so these stay `unknown`: the SDK's
   * factories type them as the union of a literal and a per-query callback, and
   * the fan-out never inspects them.
   */
  enabled?: unknown;
  staleTime?: unknown;
  gcTime?: unknown;
  refetchInterval?: unknown;
};

/** One deployment's slice of a fanned-out query. */
export interface DeploymentResult<T> {
  deployment: Deployment;
  data?: T;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export interface FanOutResult<T> {
  /** Per-deployment results, in `DEPLOYMENTS` order. */
  results: readonly DeploymentResult<T>[];
  /** True while no deployment has produced data yet. */
  isLoading: boolean;
  /** True while any deployment is refetching. */
  isFetching: boolean;
  /** Deployments that failed, with their errors. Others still render. */
  failures: readonly { deployment: Deployment; error: Error }[];
}

/**
 * Run one SDK read across every in-scope deployment at once.
 *
 * This is the whole multi-solver mechanism. The SDK's core layer ships a
 * `getXQueryOptions(config, { chainId, solverId })` factory beside every typed
 * hook; feeding those factories into `useQueries` fans a single read out over
 * N deployments in one hook call, which the per-deployment `useX()` hooks
 * cannot do (a hook cannot be called in a loop).
 *
 * The results never collide in cache because every SDK query key already
 * carries `chainId`, `solverId` and a hash of the resolved chain config.
 *
 * A deployment that fails is reported in `failures` and simply contributes no
 * rows — one solver being down never blanks the other's data.
 *
 * @param buildOptions Maps a deployment to the SDK query options for this read.
 * @param options.scope `mode` follows the palette mode; `all` ignores it.
 *
 * @example
 * ```ts
 * const markets = useDeploymentQueries((config, deployment) =>
 *   getMarketsQueryOptions(config, {
 *     chainId: deployment.chainId,
 *     solverId: deployment.solverId,
 *   }),
 * );
 * ```
 */
export function useDeploymentQueries<T>(
  buildOptions: (config: Config, deployment: Deployment) => DeploymentQueryOptions<T>,
  options: { scope?: "mode" | "all"; enabled?: boolean } = {},
): FanOutResult<T> {
  const config = useSymmioConfig();
  const { deployments: scoped } = usePrismMode();
  const { scope = "mode", enabled = true } = options;

  const deployments = useMemo(() => (scope === "mode" ? scoped : DEPLOYMENTS), [scope, scoped]);

  const queries = useQueries({
    queries: deployments.map((deployment) => {
      const built = buildOptions(config, deployment) as UseQueryOptions<T, Error, T, readonly unknown[]>;
      return {
        ...built,
        enabled: enabled && built.enabled !== false,
      };
    }),
  });

  return useMemo(() => {
    const results = deployments.map((deployment, index) => {
      const query = queries[index];
      return {
        deployment,
        data: query?.data as T | undefined,
        isLoading: query?.isLoading ?? false,
        isFetching: query?.isFetching ?? false,
        error: (query?.error as Error | null) ?? null,
      };
    });

    const failures: { deployment: Deployment; error: Error }[] = [];
    for (const result of results) {
      if (result.error) failures.push({ deployment: result.deployment, error: result.error });
    }

    return {
      results,
      isLoading: results.some((result) => result.isLoading),
      isFetching: results.some((result) => result.isFetching),
      failures,
    };
  }, [deployments, queries]);
}
