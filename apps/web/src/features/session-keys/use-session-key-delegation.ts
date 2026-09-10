"use client";

import {
  parseGaslessErrorDetail,
  useAreDelegationsActive,
  useFinalizeRevokeDelegation,
  useGrantDelegation,
  useInitiateRevokeDelegation,
  usePendingRevocation,
  useRevocationCooldown,
  useSessionKeySelectors,
  useSupportsGaslessService,
} from "@symmio/trading-react";
import { useCallback, useMemo, useState } from "react";
import { zeroAddress, type Address, type Hex } from "viem";

/** Parameters for {@link useSessionKeyDelegation}. */
export interface UseSessionKeyDelegationParameters {
  /** Sub-account the session key acts for. Reads stay disabled until it is known. */
  subAccount?: Address;
  /** The loaded session key's address, i.e. the delegate being granted. */
  sessionKey?: Address;
  /**
   * The session key's own expiry, in **milliseconds** — the value the manager
   * stores. The delegation is granted with exactly this expiry so the two can
   * never drift apart.
   */
  sessionKeyExpiresAtMs?: number;
  /**
   * Include `initiateWithdraw` in the grant. Defaults to `false`: that selector
   * carries a caller-supplied receiver, so a key holding it can move the
   * sub-account's collateral to any address.
   */
  withdraw?: boolean;
}

/** Value returned by {@link useSessionKeyDelegation}. */
export interface UseSessionKeyDelegationResult {
  /** The full selector set the current scope wants granted. */
  requiredSelectors: readonly Hex[];
  /** Selectors the contract currently enforces for this key. */
  activeSelectors: readonly Hex[];
  /** Selectors still missing — empty means the key is ready. */
  missingSelectors: readonly Hex[];
  /** `true` when every required selector is active. */
  isReady: boolean;
  /**
   * `false` on a chain whose contracts predate perps-core 0.8.6, where a
   * session key can hold the trade lifecycle but no gasless account management.
   */
  supportsAccountScope: boolean;
  /** `true` while the on-chain delegation read is in flight. */
  isLoading: boolean;
  /** Expiry the grant will use (Unix seconds), derived from the session key's own expiry. */
  expiryTimestamp?: bigint;
  /** Expiry the contract reports for the live grant, when there is one. */
  activeExpiryTimestamp?: bigint;
  /** Revocation cooldown in seconds, as configured on the Instant Layer. */
  cooldownSeconds?: bigint;
  /**
   * `true` while a scheduled revocation has not yet reached its ETA — the key
   * still signs, but it is on its way out. Read from the contract, so it
   * survives a reload and shows up in any tab.
   */
  isRevoking: boolean;
  /**
   * Seconds until the scheduled revocation lands — i.e. until the key stops
   * signing — reticking every second, and `0` once it lands.
   */
  revocationSecondsRemaining?: number;
  /** How many of {@link UseSessionKeyDelegationResult.activeSelectors} are scheduled for revocation. */
  revokingSelectorCount: number;
  /** `true` once every scheduled ETA has passed, so finalizing will go through. */
  isFinalizable: boolean;
  /** Grant the scope's selectors in one relayed, gas-free transaction. */
  grant: () => Promise<void>;
  /** Start revoking every selector this key holds. Costs native gas. */
  initiateRevoke: () => Promise<void>;
  /** Finalize a revocation whose cooldown has elapsed. Costs native gas. */
  finalizeRevoke: () => Promise<void>;
  /** `true` while any of the three writes is in flight. */
  isWriting: boolean;
  /** The last write error, normalized. */
  error: Error | null;
  /** Clear {@link UseSessionKeyDelegationResult.error}. */
  resetError: () => void;
}

/**
 * Surface what the gateway actually said.
 *
 * A relay rejection arrives as an HTTP failure whose `message` is only
 * "Request failed with status code 400" — the useful part, a decoded contract
 * revert, sits in the response body. `parseGaslessErrorDetail` digs it out.
 *
 * The revert text is read from `decoded`, not `arguments`: the vendor returns
 * the arguments keyed by name while the SDK types that field as a positional
 * array, so `decoded` is the field that reliably carries the message.
 */
function toActionableError(reason: unknown): Error {
  const detail = parseGaslessErrorDetail(reason);
  const revert = detail?.contractRevert;
  const decoded = typeof revert?.decoded === "string" ? revert.decoded : undefined;
  const text = decoded ?? revert?.error;

  /** The first wall every new sub-account hits, and the fix is a different screen. */
  if (text?.includes("OperationalFee")) {
    return new Error(
      "OperationalFee: Allowance exceeded — the relayer is paid from this sub-account's operational-fee allowance, and it is not high enough to cover the grant. Approve more on the Gasless page, then grant again.",
    );
  }
  if (text) return new Error(`${detail?.code ?? "Relay rejected"}: ${text}`);
  if (detail?.message) return new Error(detail.code ? `${detail.code}: ${detail.message}` : detail.message);

  return reason instanceof Error ? reason : new Error(String(reason));
}

/**
 * Everything the session-key onboarding UI needs about the key's Instant Layer
 * authority: the selector set for the chosen scope, which of them the contract
 * actually enforces right now, and the three writes that change that.
 *
 * The grant is relayed (`gasless: true`), so onboarding costs the owner no
 * native gas — the contract only ever accepts `grantDelegation` from the
 * account owner, which is why onboarding is exactly one wallet prompt and every
 * later action by the key needs none. **Revocation is the opposite**: the
 * Instant Layer refuses to relay it, so both revoke steps are wallet
 * transactions that cost native gas, and the key keeps its authority until the
 * cooldown ETA passes.
 *
 * @param parameters - See {@link UseSessionKeyDelegationParameters}.
 * @returns Readiness, the selector diff, and the grant/revoke writes.
 *
 * @example
 * ```tsx
 * const delegation = useSessionKeyDelegation({ subAccount, sessionKey, sessionKeyExpiresAtMs, withdraw });
 * if (!delegation.isReady) await delegation.grant();
 * ```
 */
export function useSessionKeyDelegation(parameters: UseSessionKeyDelegationParameters): UseSessionKeyDelegationResult {
  const { subAccount, sessionKey, sessionKeyExpiresAtMs, withdraw = false } = parameters;

  /**
   * The account-management and withdraw selectors exist only on perps-core
   * 0.8.6, and `getSessionKeySelectors` throws rather than silently granting a
   * narrower set. Gate them on the same condition the SDK uses for the relayer
   * itself, so an 0.8.5 chain degrades to a trade-only key instead of crashing
   * the page.
   */
  const supportsAccountScope = useSupportsGaslessService();
  const requiredSelectors = useSessionKeySelectors({
    account: supportsAccountScope,
    withdraw: withdraw && supportsAccountScope,
  });

  const enabled = Boolean(subAccount && sessionKey);
  /**
   * The read is disabled until both addresses are known, so the placeholders
   * are never sent — they exist only to keep the parameters well-typed while
   * the wallet or the session key is still resolving.
   */
  const account = useMemo(() => ({ addr: subAccount ?? zeroAddress, isPartyB: false }), [subAccount]);

  const delegations = useAreDelegationsActive({
    account,
    delegate: sessionKey ?? zeroAddress,
    selectors: requiredSelectors,
    query: { enabled },
  });
  const cooldown = useRevocationCooldown();
  const refetchDelegations = delegations.refetch;

  const activeSelectors = delegations.activeSelectors;
  const missingSelectors = delegations.missing;

  /**
   * A scheduled revocation is invisible to the readiness read — the contract
   * keeps enforcing the delegation for the whole cooldown, so
   * `useAreDelegationsActive` reports the key as active right up to the ETA.
   * This is the only read that shows the revocation in flight, and reading it
   * from the chain (rather than remembering the click) is what makes the state
   * survive a reload and show up in a second tab.
   *
   * It probes `requiredSelectors`, not `activeSelectors`: the moment the ETA
   * passes, enforcement stops and `activeSelectors` empties out — probing it
   * would drop the scheduled revocation from view and disable Finalize at
   * exactly the point it becomes callable. `activeSelectors` is filtered from
   * `requiredSelectors`, so the wider set can only ever probe more.
   */
  const pendingRevocation = usePendingRevocation({
    account,
    delegate: sessionKey ?? zeroAddress,
    selectors: requiredSelectors,
    query: { enabled },
  });
  const refetchPendingRevocation = pendingRevocation.refetch;

  /**
   * The delegation expiry is the session key's own expiry, not a fresh TTL.
   * Granting a longer-lived delegation than the key would leave stale authority
   * on-chain after the key stops working; a shorter one silently breaks the key
   * before it expires.
   */
  const expiryTimestamp = useMemo(
    () => (sessionKeyExpiresAtMs === undefined ? undefined : BigInt(Math.floor(sessionKeyExpiresAtMs / 1000))),
    [sessionKeyExpiresAtMs],
  );

  const grantDelegation = useGrantDelegation();
  const initiateRevokeDelegation = useInitiateRevokeDelegation();
  const finalizeRevokeDelegation = useFinalizeRevokeDelegation();
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async (write: () => Promise<unknown>) => {
    setError(null);
    try {
      await write();
    } catch (reason) {
      setError(toActionableError(reason));
    }
  }, []);

  const grant = useCallback(async () => {
    if (!subAccount || !sessionKey || expiryTimestamp === undefined) return;
    await run(async () => {
      await grantDelegation.mutateAsync({
        account: { addr: subAccount, isPartyB: false },
        delegatedSigner: sessionKey,
        selectors: requiredSelectors,
        expiryTimestamp,
        gasless: true,
      });
      await Promise.all([refetchDelegations(), refetchPendingRevocation()]);
    });
  }, [
    subAccount,
    sessionKey,
    expiryTimestamp,
    requiredSelectors,
    grantDelegation,
    refetchDelegations,
    refetchPendingRevocation,
    run,
  ]);

  /**
   * Revocation targets what the key actually holds, not what the current scope
   * checkbox asks for — otherwise unticking `withdraw` would silently leave the
   * withdraw authority live on-chain.
   */
  const revokableSelectors = activeSelectors.length > 0 ? activeSelectors : requiredSelectors;

  const initiateRevoke = useCallback(async () => {
    if (!subAccount || !sessionKey) return;
    await run(async () => {
      await initiateRevokeDelegation.mutateAsync({
        account: { addr: subAccount, isPartyB: false },
        delegate: sessionKey,
        selectors: revokableSelectors,
      });
      await Promise.all([refetchDelegations(), refetchPendingRevocation()]);
    });
  }, [
    subAccount,
    sessionKey,
    revokableSelectors,
    initiateRevokeDelegation,
    refetchDelegations,
    refetchPendingRevocation,
    run,
  ]);

  const finalizeRevoke = useCallback(async () => {
    if (!subAccount || !sessionKey) return;
    await run(async () => {
      await finalizeRevokeDelegation.mutateAsync({
        account: { addr: subAccount, isPartyB: false },
        delegate: sessionKey,
        selectors: revokableSelectors,
      });
      await Promise.all([refetchDelegations(), refetchPendingRevocation()]);
    });
  }, [
    subAccount,
    sessionKey,
    revokableSelectors,
    finalizeRevokeDelegation,
    refetchDelegations,
    refetchPendingRevocation,
    run,
  ]);

  return {
    requiredSelectors,
    activeSelectors,
    missingSelectors,
    isReady: enabled && delegations.allActive,
    supportsAccountScope,
    isLoading: enabled && delegations.isLoading,
    expiryTimestamp,
    activeExpiryTimestamp: delegations.expiryTimestamp,
    cooldownSeconds: cooldown.data,
    isRevoking: pendingRevocation.isRevoking,
    revocationSecondsRemaining: pendingRevocation.secondsRemaining,
    revokingSelectorCount: pendingRevocation.revokingSelectors.length,
    isFinalizable: pendingRevocation.isFinalizable,
    grant,
    initiateRevoke,
    finalizeRevoke,
    isWriting: grantDelegation.isPending || initiateRevokeDelegation.isPending || finalizeRevokeDelegation.isPending,
    error,
    resetError: useCallback(() => setError(null), []),
  };
}
