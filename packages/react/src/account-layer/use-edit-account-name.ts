"use client";

import {
  editAccountNameMutationOptions,
  getUserSubAccountsQueryKey,
  type EditAccountNameParameters,
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
 * Parameters for {@link useEditAccountName}.
 */
export type UseEditAccountNameParameters = WriteParameters;

/**
 * Result returned by the {@link useEditAccountName} mutation.
 */
export type EditAccountNameResult = WriteResult;

/** Return type of {@link useEditAccountName}. */
export type UseEditAccountNameReturnType = UseMutationResult<
  EditAccountNameResult,
  SymmioRequestError,
  EditAccountNameParameters
>;

/**
 * Submit an `editAccountName` transaction for a subaccount. On success, every
 * `getUserSubAccounts` query for the connected wallet is invalidated so mounted
 * lists refetch with the new name.
 *
 * @example
 * ```tsx
 * const { mutate, status, error } = useEditAccountName();
 * <button onClick={() => mutate({ account: "0xsub…", name: "Trading Bot" })}>Rename</button>
 * ```
 */
export function useEditAccountName(parameters: UseEditAccountNameParameters = {}): UseEditAccountNameReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const queryClient = useQueryClient();

  const base = editAccountNameMutationOptions(config);

  return useMutation<EditAccountNameResult, SymmioRequestError, EditAccountNameParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          account: variables.account,
          name: variables.name,
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
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getUserSubAccountsQueryKey, address ? { user: address } : undefined),
      });
    },
  });
}
