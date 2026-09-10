"use client";

import {
  getPendingRevocationEtasQueryOptions,
  type ConfigParameter,
  type GetPendingRevocationEtasOptions,
  type GetPendingRevocationEtasReturnType,
  type InstantLayerAccount,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link usePendingRevocation}. */
export interface UsePendingRevocationParameters extends ConfigParameter {
  /**
   * Account the delegation is enforced under — pass the same account that was
   * handed to `useInitiateRevokeDelegation`. Unlike {@link useAreDelegationsActive},
   * the underlying read does **not** canonicalize a virtual account to its
   * parent, because neither does the mapping it reads.
   */
  account: InstantLayerAccount;
  /** Delegated signer being checked, typically the session key's address. */
  delegate: Address;
  /**
   * Selectors to probe. Pass the **granted** set — the same one handed to
   * `useSessionKeySelectors` / `useAreDelegationsActive` — not that hook's
   * `activeSelectors`. Enforcement stops the moment the ETA passes, so
   * `activeSelectors` empties out exactly when the revocation becomes
   * finalizable, and probing it would hide the scheduled revocation at the one
   * moment a UI needs it.
   */
  selectors: readonly Hex[];
  /** Optional chain override; defaults to the config's chain. */
  chainId?: number;
  /** TanStack Query overrides for the underlying read. */
  query?: GetPendingRevocationEtasOptions["query"];
}

/** Return type of {@link usePendingRevocation}. */
export interface UsePendingRevocationReturnType {
  /**
   * `true` while at least one probed selector has a scheduled revocation whose
   * ETA has **not** passed — the key is still signing, but on its way out.
   */
  isRevoking: boolean;
  /**
   * The **latest** ETA across the scheduled selectors, as a Unix timestamp in
   * seconds — the moment the key stops being able to sign anything at all.
   * `undefined` when no revocation is scheduled.
   */
  etaTimestamp?: bigint;
  /**
   * Whole seconds left until {@link UsePendingRevocationReturnType.etaTimestamp},
   * recomputed every second while the revocation counts down and clamped at `0`
   * once it lands. `undefined` when no revocation is scheduled.
   *
   * This is the value to render as a live countdown: `etaTimestamp` alone is a
   * fixed instant, so formatting it relatively (`"in 9m"`) looks frozen for a
   * minute at a time.
   */
  secondsRemaining?: number;
  /**
   * Probed selectors with a scheduled revocation, in the order they were
   * requested. A selector stays in this list after its ETA passes, until
   * someone finalizes — it is scheduled either way, only no longer enforced.
   */
  revokingSelectors: readonly Hex[];
  /**
   * `true` when a revocation is scheduled and **every** scheduled ETA has
   * passed, so `useFinalizeRevokeDelegation` will go through. Finalizing while
   * any ETA is still in the future reverts with `RevocationCooldownNotOver`.
   */
  isFinalizable: boolean;
  /** `true` while the underlying read is in flight. */
  isLoading: boolean;
  /** `true` when the underlying read failed. */
  isError: boolean;
  /** The read's error, if any. */
  error: SymmioRequestError | null;
  /** Refetch the underlying read — call it after an initiate or finalize settles. */
  refetch: UseQueryResult<GetPendingRevocationEtasReturnType, SymmioRequestError>["refetch"];
  /** The full underlying query result, for states this hook does not surface. */
  query: UseQueryResult<GetPendingRevocationEtasReturnType, SymmioRequestError>;
}

/** Stable empty result so a pending read does not churn the memo's identity. */
const NO_ETAS: GetPendingRevocationEtasReturnType = new Map<Hex, bigint>();

/** Current Unix time in seconds, the unit every on-chain timestamp uses. */
function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

/**
 * "Is this key being revoked, and until when is it still live?" — the pending
 * side of the two-step revocation, against a clock that ticks.
 *
 * **This is the only way to see a revocation in flight.** `initiateRevokeDelegation`
 * does not clear the grant; it schedules one, and the contract keeps enforcing
 * the delegation until the ETA passes. {@link useAreDelegationsActive} therefore
 * keeps reporting the key as active for the whole cooldown — correctly, because
 * it is. Pair the two: that hook answers "can it sign?", this one answers "is it
 * on its way out, and when does that land?".
 *
 * The comparison runs against a 1-second clock that starts only while something
 * is actually counting down and stops itself once the last ETA passes, so
 * `isRevoking` flips to `false` and `isFinalizable` to `true` on their own —
 * a finalize button gated on them enables itself without a refresh. That same
 * clock drives `secondsRemaining`, so a live countdown needs no timer of its
 * own.
 *
 * **Probe the granted selector set, not the active one.** A delegation stops
 * being enforced at its ETA but stays scheduled until someone finalizes, so
 * `useAreDelegationsActive`'s `activeSelectors` goes empty precisely when
 * `isFinalizable` should turn `true`. Feeding that shrinking list back in here
 * would disable a finalize button at the moment it becomes callable.
 *
 * The read is skipped entirely for an empty `selectors` list — there is nothing
 * to probe — unless `query.enabled` says otherwise.
 *
 * @param parameters - Account, delegate, probed selectors, optional chain and query overrides.
 * @returns Whether a revocation is pending, its ETA, the scheduled selectors, and the read's state.
 *
 * @example
 * ```tsx
 * const { isRevoking, etaTimestamp, isFinalizable } = usePendingRevocation({
 *   account: { addr: subAccount, isPartyB: false },
 *   delegate: sessionKeyAddress,
 *   selectors: grantedSelectors,
 * });
 *
 * if (isRevoking) return <p>Revoking — still live until {formatTime(etaTimestamp)}</p>;
 * return <button disabled={!isFinalizable}>Finalize revoke</button>;
 * ```
 */
export function usePendingRevocation(parameters: UsePendingRevocationParameters): UsePendingRevocationReturnType {
  const config = useSymmioConfig(parameters);
  const { account, delegate, selectors, chainId, query } = parameters;

  const options = getPendingRevocationEtasQueryOptions(config, {
    delegator: account,
    delegate,
    selectors,
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
  }) as UseQueryResult<GetPendingRevocationEtasReturnType, SymmioRequestError>;

  const { data, isLoading, isError, error, refetch } = result;
  const etas = data ?? NO_ETAS;

  const revokingSelectors = useMemo(() => selectors.filter((selector) => etas.has(selector)), [selectors, etas]);
  const etaTimestamp = useMemo(() => {
    let latest: bigint | undefined;
    for (const eta of etas.values()) if (latest === undefined || eta > latest) latest = eta;
    return latest;
  }, [etas]);

  const [now, setNow] = useState(nowSeconds);

  /**
   * Re-key the clock on the deadline itself: it resyncs the moment a new ETA
   * arrives (the read can resolve long after mount, leaving `now` stale), ticks
   * only while that deadline is in the future, and clears itself once it
   * passes — a scheduled-but-elapsed revocation never leaves a timer running.
   */
  useEffect(() => {
    if (etaTimestamp === undefined) return;
    setNow(nowSeconds());
    if (etaTimestamp <= nowSeconds()) return;

    const id = setInterval(() => {
      const current = nowSeconds();
      setNow(current);
      if (current >= etaTimestamp) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [etaTimestamp]);

  return useMemo<UsePendingRevocationReturnType>(() => {
    let isRevoking = false;
    let allElapsed = etas.size > 0;
    for (const eta of etas.values()) {
      if (eta > now) {
        isRevoking = true;
        allElapsed = false;
      }
    }

    return {
      isRevoking,
      etaTimestamp,
      secondsRemaining: etaTimestamp === undefined ? undefined : Number(etaTimestamp > now ? etaTimestamp - now : 0n),
      revokingSelectors,
      isFinalizable: allElapsed,
      isLoading,
      isError,
      error: error ?? null,
      refetch,
      query: result,
    };
  }, [etas, now, etaTimestamp, revokingSelectors, isLoading, isError, error, refetch, result]);
}
