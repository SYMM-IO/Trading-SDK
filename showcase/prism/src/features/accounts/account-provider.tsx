"use client";

import { DEPLOYMENTS, type Deployment, type MarketFamily } from "@/config/deployments";
import { useDeploymentQueries } from "@/features/data/use-deployment-queries";
import {
  getAccountBalanceInfoQueryOptions,
  getAccountBalanceOfQueryOptions,
  getUserSubAccountsQueryOptions,
  type AccountBalanceInfo,
  type SubAccountDetail,
} from "@symmio/trading-core";
import { useSymmioConfig, useWalletAccount } from "@symmio/trading-react";
import { useQueries, type UseQueryOptions } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** A funding account, tagged with the deployment it settles on. */
export interface FundingAccount {
  address: `0x${string}`;
  name: string;
  detail: SubAccountDetail;
  deployment: Deployment;
  family: MarketFamily;
  /**
   * The allocated (classic) pool snapshot, once loaded.
   *
   * This is what a **cross-margin** account trades out of. A VA-isolated
   * account cannot reach it with an instant open at all.
   */
  balance?: AccountBalanceInfo;
  /**
   * The instant-spendable balance (`balanceOf`), once loaded, in 18 decimals.
   *
   * This is what a **VA-isolated** account trades out of — and the pot a plain
   * deposit lands in. Reading only `allocatedBalance`, as this app did, reports
   * `$0.00` for a correctly funded lowcap account.
   */
  available?: bigint;
}

interface AccountContextValue {
  /** Every funding account across every deployment. */
  accounts: readonly FundingAccount[];
  /** Accounts grouped by market family — funds never move across a group. */
  byFamily: Record<MarketFamily, readonly FundingAccount[]>;
  /** The selected account for a family, if any. */
  selected: Record<MarketFamily, FundingAccount | undefined>;
  /** Select which account a family trades from. */
  select: (family: MarketFamily, address: `0x${string}`) => void;
  isLoading: boolean;
  /** Deployments whose account list failed to load. */
  failures: readonly { deployment: Deployment; error: Error }[];
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

/**
 * Resolves the connected wallet's funding accounts on every deployment.
 *
 * A SYMMIO sub-account exists per chain, so a wallet has a separate set on Base
 * and on HyperEVM. Prism keeps them grouped: the UI can show one combined
 * equity figure, but a deposit or transfer always names its group, because the
 * two settle on different systems and funds cannot cross.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const config = useSymmioConfig();
  const { address } = useWalletAccount();
  const [selection, setSelection] = useState<Partial<Record<MarketFamily, `0x${string}`>>>({});

  const subAccounts = useDeploymentQueries<readonly SubAccountDetail[]>(
    (sdkConfig, deployment) =>
      getUserSubAccountsQueryOptions(sdkConfig, {
        chainId: deployment.chainId,
        user: address,
      }),
    { scope: "all", enabled: Boolean(address) },
  );

  /* Flatten first so balances can be fetched for every account in one
     `useQueries` call rather than one per deployment. */
  const flat = useMemo(() => {
    const rows: Omit<FundingAccount, "balance">[] = [];
    for (const result of subAccounts.results) {
      for (const detail of result.data ?? []) {
        if (!detail.isExists) continue;
        rows.push({
          address: detail.accountAddress,
          name: detail.name || "Unnamed account",
          detail,
          deployment: result.deployment,
          family: result.deployment.family,
        });
      }
    }
    return rows;
  }, [subAccounts.results]);

  const balances = useQueries({
    queries: flat.map(
      (account) =>
        getAccountBalanceInfoQueryOptions(config, {
          chainId: account.deployment.chainId,
          account: account.address,
        }) as UseQueryOptions<AccountBalanceInfo, Error, AccountBalanceInfo, readonly unknown[]>,
    ),
  });

  /* The second pot. SYMMIO keeps deposited collateral and allocated collateral
     in different places, and which one an account trades from depends on its
     isolation type — so both are read for every account and the screens pick
     the one their account's model actually spends. */
  const availables = useQueries({
    queries: flat.map(
      (account) =>
        getAccountBalanceOfQueryOptions(config, {
          chainId: account.deployment.chainId,
          account: account.address,
        }) as UseQueryOptions<bigint, Error, bigint, readonly unknown[]>,
    ),
  });

  const accounts = useMemo<FundingAccount[]>(
    () =>
      flat.map((account, index) => ({
        ...account,
        balance: balances[index]?.data as AccountBalanceInfo | undefined,
        available: availables[index]?.data as bigint | undefined,
      })),
    [flat, balances, availables],
  );

  const byFamily = useMemo(() => {
    const grouped = { majors: [], lowcaps: [] } as Record<MarketFamily, FundingAccount[]>;
    for (const account of accounts) grouped[account.family].push(account);
    return grouped;
  }, [accounts]);

  /* Default each family to its first account, and drop a stale selection when
     the wallet changes. */
  useEffect(() => {
    setSelection((current) => {
      let next = current;
      for (const deployment of DEPLOYMENTS) {
        const family = deployment.family;
        const available = byFamily[family];
        const chosen = current[family];
        const stillValid = chosen && available.some((account) => account.address === chosen);
        if (!stillValid) {
          const fallback = available[0]?.address;
          if (fallback !== chosen) {
            next = next === current ? { ...current } : next;
            next[family] = fallback;
          }
        }
      }
      return next;
    });
  }, [byFamily]);

  const select = useCallback((family: MarketFamily, accountAddress: `0x${string}`) => {
    setSelection((current) => ({ ...current, [family]: accountAddress }));
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      accounts,
      byFamily,
      selected: {
        majors: byFamily.majors.find((account) => account.address === selection.majors),
        lowcaps: byFamily.lowcaps.find((account) => account.address === selection.lowcaps),
      },
      select,
      isLoading: subAccounts.isLoading,
      failures: subAccounts.failures,
    }),
    [accounts, byFamily, selection, select, subAccounts.isLoading, subAccounts.failures],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Read the connected wallet's funding accounts across all deployments. */
export function useFundingAccounts(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useFundingAccounts must be used inside <AccountProvider>.");
  }
  return context;
}
