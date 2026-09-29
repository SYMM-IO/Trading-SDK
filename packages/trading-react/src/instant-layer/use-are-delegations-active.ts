"use client";

import {
  getActiveDelegationsQueryOptions,
  type ConfigParameter,
  type GetActiveDelegationsOptions,
  type GetActiveDelegationsReturnType,
  type InstantLayerAccount,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useAreDelegationsActive}. */
export interface UseAreDelegationsActiveParameters extends ConfigParameter {
  /**
   * Account the delegation is enforced under. May be a sub-account **or** a
   * virtual account — the underlying read canonicalizes a VA to its parent the
   * way the contract's own enforcement does.
   */
  account: InstantLayerAccount;
  /** Delegated signer being checked, typically the session key's address. */
  delegate: Address;
  /**
   * Selectors the key must hold. Pass the same set that was granted — normally
   * the output of `useSessionKeySelectors`.
   */
  selectors: readonly Hex[];
  /** Optional chain override; defaults to the config's chain. */
  chainId?: number;
  /** TanStack Query overrides for the underlying read. */
  query?: GetActiveDelegationsOptions["query"];
}

/** Return type of {@link useAreDelegationsActive}. */
export interface UseAreDelegationsActiveReturnType {
  /**
   * `true` only when every requested selector is active for the delegate. It is
   * `false` while the read is in flight and `false` for an empty `selectors`
   * list — a key that holds no authority is never "ready", and reporting a
   * vacuous `true` there would green-light a flow that cannot sign anything.
   */
  allActive: boolean;
  /**
   * Requested selectors the contract does **not** report as active, in the
   * order and casing they were requested. Until the read resolves this is the
   * full requested set, so gate on {@link UseAreDelegationsActiveReturnType.isLoading}
   * before rendering it as a re-grant list.
   */
  missing: readonly Hex[];
  /** Requested selectors the contract reports as active for the delegate. */
  activeSelectors: readonly Hex[];
  /**
   * Earliest expiry across the matched delegations, as a Unix timestamp in
   * seconds; `undefined` when nothing is active. Selectors granted in separate
   * transactions expire at different times and the contract reports only the
   * soonest, so render this as "usable until", never as a per-selector expiry.
   */
  expiryTimestamp?: bigint;
  /** `true` while the underlying read is in flight. */
  isLoading: boolean;
  /** `true` when the underlying read failed. */
  isError: boolean;
  /** The read's error, if any. */
  error: SymmioRequestError | null;
  /** Refetch the underlying read — call it after a grant or a revocation settles. */
  refetch: UseQueryResult<GetActiveDelegationsReturnType, SymmioRequestError>["refetch"];
  /** The full underlying query result, for states this hook does not surface. */
  query: UseQueryResult<GetActiveDelegationsReturnType, SymmioRequestError>;
}

/**
 * "Is my session key ready?" — whether one delegate currently holds **all** of
 * the requested selectors for an account, plus exactly which ones it is
 * missing. Drive an onboarding button off it: `allActive` gates trading,
 * `missing` tells the user what a re-grant would add.
 *
 * **It is one contract read, not one per selector.** The hook calls
 * `getActiveDelegations`, which answers the whole set in a single call *and*
 * canonicalizes the account the way enforcement does — a virtual account
 * resolves to its parent sub-account. The per-selector `getIsDelegationActive`
 * reads the raw `delegations` mapping verbatim and does not canonicalize, so a
 * fan-out over it answers `false` for a VA whose key really can act. That
 * correctness gap, not the request count, is why this hook exists.
 *
 * **A pending revocation still reads as active.** `initiateRevokeDelegation`
 * only schedules the revocation; the contract keeps enforcing the delegation
 * until the cooldown ETA passes (see `useRevocationCooldown`). A key inside
 * that window is reported here as active, because it is.
 *
 * The read is skipped entirely for an empty `selectors` list — there is nothing
 * to probe — unless `query.enabled` says otherwise.
 *
 * @param parameters - Account, delegate, requested selectors, optional chain and query overrides.
 * @returns Readiness (`allActive`, `missing`, `activeSelectors`, `expiryTimestamp`) plus the read's state.
 *
 * @example
 * ```tsx
 * const selectors = useSessionKeySelectors();
 * const { allActive, missing, isLoading } = useAreDelegationsActive({
 *   account: { addr: subAccount, isPartyB: false },
 *   delegate: sessionKeyAddress,
 *   selectors,
 * });
 *
 * if (isLoading) return <Spinner />;
 * if (!allActive) return <GrantButton missingCount={missing.length} />;
 * ```
 */
export function useAreDelegationsActive(
  parameters: UseAreDelegationsActiveParameters,
): UseAreDelegationsActiveReturnType {
  const config = useSymmioConfig(parameters);
  const { account, delegate, selectors, chainId, query } = parameters;

  const options = getActiveDelegationsQueryOptions(config, {
    delegator: account,
    delegates: [delegate],
    selectors: [selectors],
    chainId,
    query: { ...query, enabled: query?.enabled ?? selectors.length > 0 },
  });

  const result = useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseQueryResult<GetActiveDelegationsReturnType, SymmioRequestError>;

  const { data, isLoading, isError, error, refetch } = result;

  return useMemo<UseAreDelegationsActiveReturnType>(() => {
    /**
     * The contract echoes the delegate back per entry, so match on it rather
     * than trusting positional alignment — and compare case-insensitively,
     * because a checksummed request and a lowercase response are the same key.
     */
    const wanted = delegate.toLowerCase();
    const active = new Set<string>();
    let expiryTimestamp: bigint | undefined;

    for (const entry of data ?? []) {
      if (entry.delegatedSigner.toLowerCase() !== wanted) continue;
      for (const selector of entry.selectors) active.add(selector.toLowerCase());
      expiryTimestamp =
        expiryTimestamp === undefined || entry.expiryTimestamp < expiryTimestamp
          ? entry.expiryTimestamp
          : expiryTimestamp;
    }

    const activeSelectors = selectors.filter((selector) => active.has(selector.toLowerCase()));
    const missing = selectors.filter((selector) => !active.has(selector.toLowerCase()));

    return {
      allActive: selectors.length > 0 && missing.length === 0,
      missing,
      activeSelectors,
      expiryTimestamp,
      isLoading,
      isError,
      error: error ?? null,
      refetch,
      query: result,
    };
  }, [data, delegate, selectors, isLoading, isError, error, refetch, result]);
}
