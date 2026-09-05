"use client";

import type { SubAccountIsolationType } from "@symmio/trading-core";
import type { Address } from "viem";
import { useSubAccount } from "../account-layer/use-sub-account";
import { useVirtualAccount } from "../account-layer/use-virtual-account";

/** Parameters for {@link useGroupingIsolation}. */
export interface UseGroupingIsolationParameters {
  /** The account whose owning sub-account's isolation is wanted. Sub-account or Virtual Account. */
  account?: Address;
  /** Target chain id. Defaults to the connected chain. */
  chainId?: number;
  /** Master switch; when `false` no read fires. Default `true`. */
  enabled?: boolean;
}

/**
 * Resolve the isolation type of the sub-account that owns `account`.
 *
 * `account` may be the sub-account itself or one of its Virtual Accounts, so
 * this walks up when needed: read `getSubAccount(account)` first, and only when
 * that comes back non-existent read `getVirtualAccount(account)` and resolve its
 * `parentAccount`. Both hops are fixed at creation time on-chain, so every read
 * is cached indefinitely — the steady-state cost after the first resolve is zero.
 *
 * Returns `undefined` while the reads are in flight, when they fail, and when
 * `account` is neither a sub-account nor a Virtual Account. Callers must treat
 * `undefined` as "unknown", never as "unsupported".
 *
 * @param parameters - Account to resolve, optional chain id, optional master switch.
 * @returns The owning sub-account's isolation type, or `undefined` while unknown.
 *
 * @example
 * ```tsx
 * const isolationType = useGroupingIsolation({ account: partyA });
 * const blocked = isolationType !== undefined && !supportsQuoteGrouping(isolationType);
 * ```
 */
export function useGroupingIsolation(parameters: UseGroupingIsolationParameters): SubAccountIsolationType | undefined {
  const { account, chainId, enabled = true } = parameters;
  const active = enabled && Boolean(account);

  /**
   * Isolation is fixed when the account is created and never changes, so both
   * lookups are cached for the whole session.
   */
  const fixed = { staleTime: Infinity, gcTime: Infinity } as const;

  const subAccount = useSubAccount({ account, chainId, query: { ...fixed, enabled: active } });

  /**
   * `isExists: false` is the contract's answer for "not a sub-account" — which is
   * exactly what a Virtual Account address returns. Only then is the VA hop worth
   * a read.
   */
  const isVirtualAccountCandidate = subAccount.data?.isExists === false;
  const virtualAccount = useVirtualAccount({
    account,
    chainId,
    query: { ...fixed, enabled: active && isVirtualAccountCandidate },
  });

  const parentAccount = virtualAccount.data?.isExists ? virtualAccount.data.parentAccount : undefined;
  const parentSubAccount = useSubAccount({
    account: parentAccount,
    chainId,
    query: { ...fixed, enabled: active && Boolean(parentAccount) },
  });

  /**
   * A disabled lookup must resolve to "unknown", never read through to cache.
   * `enabled: false` stops React Query from *fetching*, but it still hands back
   * whatever another hook has already cached under the same key — so a caller
   * that opted out (e.g. a custom `{ keyOf }` grouping strategy passes
   * `enabled: false`) would otherwise leak an isolation the moment anything else
   * (an order ticket's `useSubAccount`, say) populated that account's cache. Gate
   * the reads on `active` so the opt-out actually opts out.
   */
  if (!active) return undefined;
  if (subAccount.data?.isExists) return subAccount.data.isolationType;
  if (parentSubAccount.data?.isExists) return parentSubAccount.data.isolationType;
  return undefined;
}
