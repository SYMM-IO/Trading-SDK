"use client";
import { getGaslessWalletExecuteSelectors, type GaslessWalletCall } from "@symmio/trading-core";
import { useRef } from "react";
import type { Hex } from "viem";

/** Parameters for {@link useGaslessWalletExecuteSelectors}. */
export interface UseGaslessWalletExecuteSelectorsParameters {
  /**
   * The batch the session key must be able to run. Pass `undefined` while the
   * UI cannot yet describe one — the hook then returns an empty set rather
   * than a partial grant.
   */
  calls?: readonly GaslessWalletCall[];
}

/** Return type of {@link useGaslessWalletExecuteSelectors}: the selector set to grant. */
export type UseGaslessWalletExecuteSelectorsReturnType = readonly Hex[];

/** Shared empty result, so "no batch yet" keeps one stable reference. */
const EMPTY_SELECTORS: readonly Hex[] = [];

/**
 * The selector set a session key must hold before it may sign a delegated
 * {@link useGaslessWalletExecute} batch: the wallet-execution sentinel plus
 * every inner call's own selector.
 *
 * This is **not** the set {@link useSessionKeySelectors} returns. That one
 * covers AccountLayer and trade writes; wallet execution is checked selector by
 * selector against the batch itself, so a key onboarded for trading and account
 * management still holds none of the authority this needs. Grant both sets to a
 * key that does both.
 *
 * The delegation must be granted on a **sub-account**, never on the owner EOA:
 * `grantDelegation` is owner-only and the AccountLayer knows no owner for a
 * bare EOA. Pass that same sub-account as the execute call's `signerAccount`.
 *
 * The result keeps its reference while the selector set is unchanged, even
 * though the batch is typically rebuilt on every keystroke, so it is safe to
 * pass straight into `useAreDelegationsActive` or a mutation's variables.
 *
 * @param parameters - The batch to derive the grant from.
 * @returns The lowercase, de-duplicated selector set, sentinel first.
 *
 * @example
 * ```tsx
 * const selectors = useGaslessWalletExecuteSelectors({ calls });
 * const delegation = useAreDelegationsActive({ account, delegate: sessionKey, selectors });
 * if (!delegation.isActive) await grant({ account, delegatedSigner: sessionKey, selectors, expiryTimestamp });
 * ```
 */
export function useGaslessWalletExecuteSelectors(
  parameters: UseGaslessWalletExecuteSelectorsParameters = {},
): UseGaslessWalletExecuteSelectorsReturnType {
  const { calls } = parameters;
  const selectors =
    calls === undefined || calls.length === 0 ? EMPTY_SELECTORS : getGaslessWalletExecuteSelectors(calls);
  const signature = selectors.join(",");

  /**
   * Selectors are canonical lowercase `bytes4` hex, so their join is a faithful
   * identity for the set. Holding the previous array while that identity is
   * unchanged keeps a caller's query from refetching on every render.
   */
  const cache = useRef<{ signature: string; value: readonly Hex[] }>({ signature, value: selectors });
  if (cache.current.signature !== signature) cache.current = { signature, value: selectors };

  return cache.current.value;
}
