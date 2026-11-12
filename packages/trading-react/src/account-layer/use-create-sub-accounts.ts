"use client";

import {
  createSubAccountsMutationOptions,
  getSubAccountsCountOfUserQueryKey,
  getUserSubAccountsAddressesQueryKey,
  getUserSubAccountsQueryKey,
  type CreateSubAccountsParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
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
 * Submit a `createSubAccounts` transaction through the configured SDK wallet.
 * On success, all owner variants of `getUserSubAccounts`,
 * `getUserSubAccountsAddresses`, and `getSubAccountsCountOfUser` queries are
 * invalidated. A host embedded wallet or session signer need not match wagmi's
 * connected address.
 *
 * To make creation recoverable, pass `gasless.idempotencyKey` in the
 * variables — one key per user action, saved before calling — and call the
 * mutation again with the same key after an unknown outcome.
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
  const queryClient = useQueryClient();

  const base = createSubAccountsMutationOptions(config);

  return useMutation<CreateSubAccountsResult, SymmioRequestError, CreateSubAccountsParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({ ...variables, chainId: resolvedChainId });
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
      // The host resolver may use an embedded owner or a session key unrelated to wagmi.
      // Invalidate every owner variant; active lists refetch without an extra owner RPC.
      void queryClient.invalidateQueries({ predicate: predicateMatch(getUserSubAccountsQueryKey) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getUserSubAccountsAddressesQueryKey) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getSubAccountsCountOfUserQueryKey) });
    },
  });
}
