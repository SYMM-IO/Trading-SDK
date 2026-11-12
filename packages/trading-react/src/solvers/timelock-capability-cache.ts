"use client";

import {
  getSolverInfoQueryOptions,
  TimelockApprovalHttpError,
  type Config,
  type SolverId,
  type TimelockApprovalCapability,
} from "@symmio/trading-core";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";

/** Keep positive discovery scoped to one solver deployment and QueryClient. */
export function timelockCapabilityKey(config: Config, chainId: number, solverId?: SolverId) {
  const chain = config.getChainConfig(chainId);
  const solver = config.getSolver({ chainId, solverId });
  return [
    "symmio",
    "known-timelock-capability",
    chainId,
    chain.addresses.accountLayerAddress.toLowerCase(),
    solver.id,
    solver.url,
  ] as const;
}

export function rememberTimelockCapability(
  client: QueryClient,
  key: ReturnType<typeof timelockCapabilityKey>,
  capability: TimelockApprovalCapability | undefined,
) {
  if (!capability) return;
  client.setQueryDefaults(key, { gcTime: Infinity, staleTime: Infinity });
  client.setQueryData(key, capability);
}

/** Recheck availability after a transport outage without retrying the approval request. */
export async function refreshTimelockInfoAfterUnavailable(
  client: QueryClient,
  config: Config,
  chainId: number,
  solverId: SolverId,
  error: unknown,
) {
  if (!(error instanceof TimelockApprovalHttpError) || (error.status !== 0 && error.status < 500)) return;
  try {
    if (config.getSolver({ chainId, solverId }).id !== "enigma") return;
    const key = timelockCapabilityKey(config, chainId, solverId);
    const options = getSolverInfoQueryOptions(config, { chainId, solverId });
    const isDefault = config.getSolver({ chainId }).id === solverId;
    const queries = isDefault ? [options, getSolverInfoQueryOptions(config, { chainId })] : [options];
    let shared: ReturnType<typeof options.queryFn> | undefined;
    const queryFn = async () => {
      try {
        if (!shared) {
          const pending = options.queryFn();
          shared = pending;
          void pending.then(
            () => {
              if (shared === pending) shared = undefined;
            },
            () => {
              if (shared === pending) shared = undefined;
            },
          );
        }
        const info = await shared;
        rememberTimelockCapability(client, key, info.timelockApproval);
        return info;
      } catch (failure) {
        throw normalizeSymmError(failure);
      }
    };
    await Promise.allSettled(
      queries.map((query) => client.fetchQuery({ ...query, retry: false, staleTime: 0, queryFn })),
    );
  } catch {
    // Preserve the original approval error and previously confirmed capability.
  }
}

export function useKnownTimelockCapability(config: Config, chainId: number, solverId?: SolverId) {
  const client = useQueryClient();
  const key = useMemo(() => {
    try {
      return timelockCapabilityKey(config, chainId, solverId);
    } catch {
      // Disabled and invalid queries must retain the normal query error behavior.
      return undefined;
    }
  }, [config, chainId, solverId]);
  const subscribe = useCallback(
    (callback: () => void) =>
      client.getQueryCache().subscribe((event) => {
        if (
          key &&
          event.query.queryKey.length === key.length &&
          key.every((part, index) => event.query.queryKey[index] === part)
        )
          callback();
      }),
    [client, key],
  );
  const snapshot = useCallback(
    () => (key ? client.getQueryData<TimelockApprovalCapability>(key) : undefined),
    [client, key],
  );
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}
