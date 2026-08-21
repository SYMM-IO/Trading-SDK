"use client";

import type { Deployment, MarketFamily } from "@/config/deployments";
import { useFundingAccounts, type FundingAccount } from "@/features/accounts/account-provider";
import { usePrismMode } from "@/features/mode/mode-provider";
import { shortenAddress } from "@/lib/format";
import type { SubAccountIsolationType } from "@symmio/trading-core";
import { useWalletAccount } from "@symmio/trading-react";
import { useCallback, useMemo } from "react";
import type { Address } from "viem";
import type { AccountFilter, SolverFilter } from "./activity-types";

/**
 * One subgraph read target: the accounts on a single deployment that share one
 * `SubAccountIsolationType`.
 *
 * `getQuoteHistory` picks its subgraph filter field from the isolation type —
 * `CUSTOM` (cross-margin) quotes carry no `subAccount` and must be matched on
 * `partyA`, while VA-isolated quotes are matched on `subAccount`. Accounts in
 * one call therefore have to agree on it, which is why the history read fans
 * out over these groups rather than straight over deployments.
 */
export interface ActivityAccountGroup {
  /** Stable key for `useQueries` and React lists. */
  key: string;
  deployment: Deployment;
  family: MarketFamily;
  isolationType: SubAccountIsolationType;
  /** Sub-account addresses in this group. Never a Virtual Account — see `use-quote-history-rows`. */
  accounts: readonly Address[];
}

/** One entry in the account dropdown. */
export interface ActivityAccountOption {
  value: Address;
  label: string;
  /** The sub-account address — the option's second line and a search key. */
  address: Address;
}

/**
 * The account options of a single deployment, foldable as a unit.
 *
 * Deployment is the only grouping worth offering: it is the boundary funds
 * never cross, and it is what a trader means when they say "my Lowcaps
 * accounts". A wallet can hold a dozen accounts per chain, so the dropdown
 * lets a whole deployment collapse rather than making the user scroll past it.
 */
export interface ActivityAccountOptionGroup {
  family: MarketFamily;
  /** Deployment label, e.g. `Majors`. */
  label: string;
  /** Chain the deployment settles on. */
  chainName: string;
  /** Tier-1 token prefix driving the group's tone dot: `mj` or `lc`. */
  tone: "mj" | "lc";
  options: readonly ActivityAccountOption[];
}

export interface ActivityAccountsResult {
  /** Deployments the mode and the solver filter both allow. */
  deployments: readonly Deployment[];
  /** Funding accounts in scope after both filters. */
  accounts: readonly FundingAccount[];
  /** Read targets for the quote-history fan-out, one per deployment × isolation type. */
  groups: readonly ActivityAccountGroup[];
  /** Sub-account addresses per family, for reads that take a plain account list. */
  addressesFor: (family: MarketFamily) => readonly Address[];
  /** Dropdown options grouped by deployment, scoped to the solver filter. */
  optionGroups: readonly ActivityAccountOptionGroup[];
  /**
   * The account filter after clamping — picks that fell out of scope are
   * dropped, and a selection left empty by that means "every account".
   */
  resolvedAccounts: AccountFilter;
  /**
   * Display name for a sub-account address, for row-level attribution.
   *
   * Rows come back from the subgraphs and the sockets carrying addresses only,
   * so the table cannot say which of a wallet's dozen accounts produced a row
   * without this. Falls back to the shortened address for anything outside the
   * wallet's own set — a margin move's counterparty, a Virtual Account.
   */
  nameFor: (address: Address | null | undefined) => string;
  /** True while the sub-account lists are still resolving. */
  isLoading: boolean;
  /** True once a wallet is connected; every read on this screen needs one. */
  isConnected: boolean;
}

/**
 * Resolve which funding accounts the Activity screen should read, given the
 * palette mode plus the screen's own solver and account filters.
 *
 * The mode decides which deployments exist at all; the solver filter narrows
 * within that, and the account filter narrows to any subset of the sub-accounts
 * that survive it. Because the account list is itself scoped, an account picked
 * before a solver switch can fall out of scope — the hook drops it and reports
 * the clamped selection so the control never displays a pick it is not honouring.
 */
export function useActivityAccounts(solver: SolverFilter, selection: AccountFilter): ActivityAccountsResult {
  const { deployments } = usePrismMode();
  const { accounts, isLoading } = useFundingAccounts();
  const { isConnected } = useWalletAccount();

  const scopedDeployments = useMemo(
    () => deployments.filter((deployment) => solver === "all" || deployment.family === solver),
    [deployments, solver],
  );

  const inScope = useMemo(
    () => accounts.filter((entry) => scopedDeployments.some((deployment) => deployment.family === entry.family)),
    [accounts, scopedDeployments],
  );

  /* A pick made before a solver or mode switch can fall out of scope; it is
     dropped rather than honoured, and the control is told so it never shows a
     selection the reads are not using. */
  const resolvedAccounts = useMemo<AccountFilter>(
    () => selection.filter((address) => inScope.some((entry) => entry.address === address)),
    [selection, inScope],
  );

  const selected = useMemo(
    () =>
      resolvedAccounts.length === 0 ? inScope : inScope.filter((entry) => resolvedAccounts.includes(entry.address)),
    [inScope, resolvedAccounts],
  );

  const groups = useMemo(() => {
    const byKey = new Map<string, { group: ActivityAccountGroup; accounts: Address[] }>();

    for (const entry of selected) {
      const key = `${entry.family}:${entry.detail.isolationType}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.accounts.push(entry.address);
        continue;
      }
      const collected: Address[] = [entry.address];
      byKey.set(key, {
        group: {
          key,
          deployment: entry.deployment,
          family: entry.family,
          isolationType: entry.detail.isolationType,
          accounts: collected,
        },
        accounts: collected,
      });
    }

    return [...byKey.values()].map((entry) => entry.group);
  }, [selected]);

  const optionGroups = useMemo<ActivityAccountOptionGroup[]>(() => {
    const byFamily = new Map<MarketFamily, ActivityAccountOptionGroup & { options: ActivityAccountOption[] }>();

    for (const entry of inScope) {
      let group = byFamily.get(entry.family);
      if (!group) {
        group = {
          family: entry.family,
          label: entry.deployment.label,
          chainName: entry.deployment.chainName,
          tone: entry.deployment.tone,
          options: [],
        };
        byFamily.set(entry.family, group);
      }
      group.options.push({ value: entry.address, label: entry.name, address: entry.address });
    }

    return [...byFamily.values()];
  }, [inScope]);

  const addressesByFamily = useMemo(() => {
    const grouped = new Map<MarketFamily, Address[]>();
    for (const entry of selected) {
      const bucket = grouped.get(entry.family);
      if (bucket) bucket.push(entry.address);
      else grouped.set(entry.family, [entry.address]);
    }
    return grouped;
  }, [selected]);

  /* Keyed lowercase: subgraph rows and socket frames are not guaranteed to
     agree with the account list on checksum casing. */
  const namesByAddress = useMemo(() => {
    const names = new Map<string, string>();
    for (const entry of accounts) names.set(entry.address.toLowerCase(), entry.name);
    return names;
  }, [accounts]);

  const nameFor = useCallback(
    (address: Address | null | undefined) =>
      address ? (namesByAddress.get(address.toLowerCase()) ?? shortenAddress(address)) : "—",
    [namesByAddress],
  );

  return useMemo<ActivityAccountsResult>(
    () => ({
      deployments: scopedDeployments,
      accounts: selected,
      groups,
      addressesFor: (family) => addressesByFamily.get(family) ?? EMPTY_ADDRESSES,
      optionGroups,
      resolvedAccounts,
      nameFor,
      isLoading,
      isConnected,
    }),
    [
      scopedDeployments,
      selected,
      groups,
      addressesByFamily,
      optionGroups,
      resolvedAccounts,
      nameFor,
      isLoading,
      isConnected,
    ],
  );
}

/** Stable empty list so `addressesFor` never hands a query a fresh array. */
const EMPTY_ADDRESSES: readonly Address[] = [];
