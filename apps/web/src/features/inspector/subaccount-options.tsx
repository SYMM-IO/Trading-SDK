"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useUserSubAccounts } from "@symm-frontier/react";
import type { AccountPickerItem, AccountPickerListState } from "@symm-frontier/ui/components/account-combobox";
import { shortenAddress } from "@symm-frontier/utils";
import { useMemo } from "react";
import type { Address } from "viem";

type SubAccountsQuery = ReturnType<typeof useUserSubAccounts>;

/**
 * Resolve an owner's subaccounts into picker-ready `items` plus the derived
 * list state. Shared by every subaccount input so the picker behaves the same
 * everywhere.
 */
export function useSubAccountOptions(owner?: Address) {
  const query = useUserSubAccounts({ user: owner });

  const items = useMemo<AccountPickerItem[]>(
    () =>
      query.data?.map((sub) => ({
        id: sub.accountAddress,
        title: sub.name || "Unnamed",
        meta: shortenAddress(sub.accountAddress),
      })) ?? [],
    [query.data],
  );

  return { query, items, listState: getSubAccountListState(query) };
}

function getSubAccountListState(query: SubAccountsQuery): AccountPickerListState {
  if (query.isLoading) return "loading";
  if (query.error) return "error";
  if (!query.data) return "idle";
  if (query.data.length === 0) return "empty";
  return "ready";
}

/** The non-ready message rendered inside a subaccount picker. */
export function SubAccountListMessage({ idPrefix, query }: { idPrefix: string; query: SubAccountsQuery }) {
  if (query.error) {
    return <ResultError testId={`${idPrefix}-list-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${idPrefix}-list-idle`}>Connect a wallet or enter a user address.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${idPrefix}-list-empty`}>No subaccounts found for this address.</ResultNote>;
  }
  return null;
}
