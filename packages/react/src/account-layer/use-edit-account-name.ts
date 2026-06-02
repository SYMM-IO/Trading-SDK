"use client";

import {
  editAccountNameMutationOptions,
  getUserSubAccountsQueryKey,
  type ConfigParameter,
  type EditAccountNameParameters,
} from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { Hash, TransactionReceipt } from "viem";
import { useAccount } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useEditAccountName}.
 */
export interface UseEditAccountNameParameters extends ConfigParameter {
  /**
   * Resolve only after the receipt is mined (default `true`). Set `false` to
   * resolve as soon as the tx hash is broadcast — useful for optimistic UIs.
   */
  waitForReceipt?: boolean;
  /** Confirmations to wait for when `waitForReceipt` is true. Defaults to `1`. */
  confirmations?: number;
}

/**
 * Result returned by the {@link useEditAccountName} mutation.
 */
export interface EditAccountNameResult {
  /** The submitted transaction hash. */
  hash: Hash;
  /** The mined receipt, present when `waitForReceipt` is enabled. */
  receipt?: TransactionReceipt;
}

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
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const waitForReceipt = parameters.waitForReceipt ?? true;
  const confirmations = parameters.confirmations ?? 1;
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
        if (!waitForReceipt) return { hash };
        const receipt = await config
          .getClient({ chainId: resolvedChainId })
          .waitForTransactionReceipt({ hash, confirmations });
        return { hash, receipt };
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
