import { getUserSubAccounts, type SubAccountDetail } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSigner } from "./use-signer.js";

interface SubAccountContextValue {
  owner?: Address;
  /** Existing (non-deleted) sub-accounts owned by the connected wallet. */
  list: SubAccountDetail[];
  /** The active sub-account — the `partyA` for reads and target of writes. */
  subAccount?: Address;
  subAccountDetail?: SubAccountDetail;
  subAccountName?: string;
  isLoading: boolean;
  error: unknown;
  select: (address: Address) => void;
  refetch: () => void;
}

const SubAccountContext = createContext<SubAccountContextValue>({
  list: [],
  isLoading: false,
  error: null,
  select: () => undefined,
  refetch: () => undefined,
});

/**
 * Loads the connected wallet's sub-accounts and tracks the selected one. The
 * selection auto-settles on the first existing sub-account and resets when the
 * wallet changes; every trading surface reads `subAccount` from here.
 */
export function SubAccountProvider({ children }: { children: ReactNode }) {
  const { config, chainId } = useSdkScope();
  const { address: owner } = useSigner();
  const [selected, setSelected] = useState<Address | undefined>(undefined);

  const query = useQuery({
    queryKey: ["subAccounts", chainId, owner],
    queryFn: async () => {
      const all = await getUserSubAccounts(config, { chainId, user: owner as Address });
      return all.filter((account) => account.isExists);
    },
    enabled: Boolean(owner),
    staleTime: 30_000,
  });

  useEffect(() => {
    setSelected(undefined);
  }, [owner, chainId]);

  const list = useMemo(() => query.data ?? [], [query.data]);
  const { isLoading, error, refetch } = query;

  /**
   * Identity-stable (react-query's `refetch` is), so sheets can list it in
   * effect dependencies without the effect re-firing every time the query's
   * loading state flips — which would re-run the refetch and loop.
   */
  const doRefetch = useCallback(() => void refetch(), [refetch]);

  const subAccount = useMemo(() => {
    if (selected && list.some((account) => account.accountAddress === selected)) return selected;
    return list[0]?.accountAddress;
  }, [selected, list]);
  const subAccountDetail = useMemo(
    () => list.find((account) => account.accountAddress === subAccount),
    [list, subAccount],
  );

  const value = useMemo<SubAccountContextValue>(
    () => ({
      owner,
      list,
      subAccount,
      subAccountDetail,
      subAccountName: subAccountDetail?.name,
      isLoading,
      error,
      select: setSelected,
      refetch: doRefetch,
    }),
    [owner, list, subAccount, subAccountDetail, isLoading, error, doRefetch],
  );

  return <SubAccountContext.Provider value={value}>{children}</SubAccountContext.Provider>;
}

/** Access the active sub-account and the owner's sub-account list. */
export function useSubAccount(): SubAccountContextValue {
  return useContext(SubAccountContext);
}
