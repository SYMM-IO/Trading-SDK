"use client";

import {
  createSubAccountsMutationOptions,
  getSubAccountsCountOfUserQueryKey,
  getUserSubAccountsAddressesQueryKey,
  getUserSubAccountsQueryKey,
  type CreateSubAccountsParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useCreateSubAccounts}.
 */
export type UseCreateSubAccountsParameters = WriteParameters;

/**
 * Result returned by the {@link useCreateSubAccounts} mutation.
 */
export type CreateSubAccountsResult = WriteResult;

/** Return type of {@link useCreateSubAccounts}. */
export type UseCreateSubAccountsReturnType = UseMutationResult<
  CreateSubAccountsResult,
  SymmioRequestError,
  CreateSubAccountsParameters
>;

/**
 * Submit a `createSubAccounts` transaction. The connected wallet becomes the
 * `owner` of every created subaccount. On success, the connected user's
 * `getUserSubAccounts`, `getUserSubAccountsAddresses`, and
 * `getSubAccountsCountOfUser` queries are invalidated so mounted lists refetch.
 *
 * @remarks
 * The created subaccount addresses are not returned directly — read them from the
 * refetched list (or the `SubAccountCreated` receipt events). This hook resolves
 * with the tx hash (and receipt when `waitForReceipt` is enabled).
 *
 * @example
 * ```tsx
 * const { mutate, status, error } = useCreateSubAccounts();
 * mutate({
 *   affiliate,
 *   accountsData: [{ name: "Main", metadata: "0x", symmioCore, isolationType, singleVAMode }],
 * });
 * ```
 */
export function useCreateSubAccounts(parameters: UseCreateSubAccountsParameters = {}): UseCreateSubAccountsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const queryClient = useQueryClient();

  const base = createSubAccountsMutationOptions(config);

  return useMutation<CreateSubAccountsResult, SymmioRequestError, CreateSubAccountsParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          affiliate: variables.affiliate,
          accountsData: variables.accountsData,
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
