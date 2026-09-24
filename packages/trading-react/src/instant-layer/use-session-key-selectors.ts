"use client";

import { getSessionKeySelectors, type ConfigParameter, type SessionKeySelectorScope } from "@symmio/trading-core";
import { useMemo } from "react";
import type { Hex } from "viem";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSessionKeySelectors}: the target chain plus the authority scope. */
export interface UseSessionKeySelectorsParameters extends ConfigParameter, SessionKeySelectorScope {
  /** Chain to resolve the selector set for; defaults to the connected chain. */
  chainId?: number;
}

/** Return type of {@link useSessionKeySelectors}: the de-duplicated selector set to grant. */
export type UseSessionKeySelectorsReturnType = readonly Hex[];

/**
 * **The** selector set to hand a session key — the set to pass to
 * `useGrantDelegation` (and to `useAreDelegationsActive` when checking whether
 * that key is still usable). It resolves the chain's contracts generation, so a
 * multi-chain app never grants the other generation's open-leg selector.
 *
 * The default scope is the onboarding grant: the instant trade lifecycle plus
 * gasless account management. Because the contract enforces that
 * `grantDelegation` is owner-only, that single grant is the *only* wallet
 * prompt a session key ever costs — every write it covers afterwards is
 * promptless and gas-free.
 *
 * `initiateWithdraw` is **opt-out by default** (`withdraw` defaults to
 * `false`): its calldata carries a caller-supplied `receiver`, so a key holding
 * it can send the sub-account's collateral to an address of its own choosing.
 * Pass `withdraw: true` only for a key that must run withdrawals unattended,
 * and treat it as a materially larger grant.
 *
 * The result is referentially stable across renders while the chain and scope
 * flags do not change, so it is safe to pass straight into a mutation's
 * variables or another hook's parameters.
 *
 * @param parameters - Optional chain override, scope flags, and `config`.
 * @returns The lowercase, de-duplicated selector set for the requested scope.
 * @throws {SymmError} `UNSUPPORTED_CHAIN` when the chain is not configured.
 * @throws {SymmError} `GASLESS_UNSUPPORTED_CONTRACTS_VERSION` when the `account`
 *   or `withdraw` scope is requested on a chain whose contracts are not
 *   `"0.8.6"`. Render a trade-only key there with `{ account: false }`.
 *
 * @example
 * ```tsx
 * const selectors = useSessionKeySelectors();
 * const { mutate } = useGrantDelegation();
 * mutate({ account: { addr: subAccount, isPartyB: false }, delegatedSigner, selectors, expiryTimestamp });
 * ```
 *
 * @example
 * ```tsx
 * // A key that also withdraws unattended — it can move the collateral out.
 * const selectors = useSessionKeySelectors({ withdraw: true });
 * ```
 */
export function useSessionKeySelectors(
  parameters: UseSessionKeySelectorsParameters = {},
): UseSessionKeySelectorsReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChainId = useSymmioChainId();
  const { trade, account, withdraw } = parameters;
  const chainId = parameters.chainId ?? connectedChainId;

  return useMemo(
    () => getSessionKeySelectors(config, { chainId, trade, account, withdraw }),
    [config, chainId, trade, account, withdraw],
  );
}
