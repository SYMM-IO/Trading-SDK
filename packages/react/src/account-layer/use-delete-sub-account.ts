"use client";

import {
  deleteSubAccountMutationOptions,
  getSubAccountsCountOfUserQueryKey,
  getUserSubAccountsAddressesQueryKey,
  getUserSubAccountsQueryKey,
  type DeleteSubAccountParameters,
} from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useDeleteSubAccount}.
 */
export type UseDeleteSubAccountParameters = WriteParameters;

/**
 * Result returned by the {@link useDeleteSubAccount} mutation.
 */
export type DeleteSubAccountResult = WriteResult;

/** Return type of {@link useDeleteSubAccount}. */
export type UseDeleteSubAccountReturnType = UseMutationResult<
  DeleteSubAccountResult,
  SymmioRequestError,
  DeleteSubAccountParameters
>;

/**
 * Submit a `deleteSubAccount` transaction. Deletion is irreversible and only
 * succeeds once the subaccount has no virtual accounts, zero balance, no open
 * positions, and no pending quotes (the call reverts otherwise). On success, the
 * connected user's `getUserSubAccounts`, `getUserSubAccountsAddresses`, and
 * `getSubAccountsCountOfUser` queries are invalidated so mounted lists refetch
 * without the removed subaccount.
 *
 * @example
 * ```tsx
 * const { mutate, status, error } = useDeleteSubAccount();
 * <button onClick={() => mutate({ subAccount: "0xsub…" })}>Delete</button>
 * ```
 */
export function useDeleteSubAccount(parameters: UseDeleteSubAccountParameters = {}): UseDeleteSubAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const queryClient = useQueryClient();

  const base = deleteSubAccountMutationOptions(config);

  return useMutation<DeleteSubAccountResult, SymmioRequestError, DeleteSubAccountParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          subAccount: variables.subAccount,
          simulateBeforeWrite: variables.simulateBeforeWrite,
          chainId: resolvedChainId,
        });
        return resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      const partial = address ? { user: address } : undefined;
      void queryClient.invalidateQueries({ predicate: predicateMatch(getUserSubAccountsQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getUserSubAccountsAddressesQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getSubAccountsCountOfUserQueryKey, partial) });
    },
  });
}
