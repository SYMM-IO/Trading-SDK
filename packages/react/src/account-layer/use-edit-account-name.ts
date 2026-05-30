"use client";

import { SymmError } from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { Address, Hash } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioClient } from "../provider/use-symmio-client";
import { predicateMatch } from "../utils";
import { accountLayerQueryKeys } from "./query-keys";

/**
 * Options accepted by {@link useEditAccountName}.
 */
export interface UseEditAccountNameOptions {
  /**
   * If `true` (the default) the mutation resolves only after the receipt is
   * mined. Set to `false` to resolve as soon as the tx hash is broadcast —
   * useful for optimistic UIs that handle confirmation separately.
   */
  waitForReceipt?: boolean;
  /**
   * Number of confirmations to wait for when `waitForReceipt` is true. Defaults
   * to `1`. HyperEVM finality is fast, so the default suits most UIs.
   */
  confirmations?: number;
}

/**
 * Parameters for editAccountName mutation.
 */
export interface EditAccountNameMutationParams {
  /** Subaccount address to rename */
  account: Address;
  /** New name for the subaccount */
  name: string;
}

/**
 * Result returned by {@link useEditAccountName}'s mutation.
 */
export interface EditAccountNameResult {
  /** The submitted transaction hash. */
  hash: Hash;
  /** The mined receipt, present when `waitForReceipt` is enabled. */
  receipt?: Awaited<ReturnType<import("viem").PublicClient["waitForTransactionReceipt"]>>;
}

/**
 * Submit an `editAccountName` transaction for the user's subaccount.
 *
 * The mutation uses the SDK client created from the host's wagmi config.
 * After success, the `getUserSubAccounts` query is invalidated for the SDK's
 * active chain so any mounted list rerenders with the new name on the next refetch.
 *
 * @example
 * const { mutate, status, error } = useEditAccountName();
 * <button onClick={() => mutate({ account: "0xsub...", name: "Trading Bot" })}>
 *   Rename
 * </button>
 */
export function useEditAccountName(
  options?: UseEditAccountNameOptions,
): UseMutationResult<EditAccountNameResult, SymmioRequestError, EditAccountNameMutationParams> {
  const client = useSymmioClient();
  const queryClient = useQueryClient();

  const waitForReceipt = options?.waitForReceipt ?? true;
  const confirmations = options?.confirmations ?? 1;

  return useMutation<EditAccountNameResult, SymmioRequestError, EditAccountNameMutationParams>({
    mutationFn: async (params) => {
      if (!client) {
        throw normalizeSymmError(new SymmError("No public client available for the configured chain."));
      }
      if (!client.walletClient) {
        throw normalizeSymmError(new SymmError("Wallet not connected, or wallet is on a different chain."));
      }

      try {
        const hash = await client.editAccountName({
          account: params.account,
          name: params.name,
        });

        if (!waitForReceipt) return { hash };

        const receipt = await client.publicClient.waitForTransactionReceipt({ hash, confirmations });
        return { hash, receipt };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      const user = client?.walletClient?.account.address;
      if (!user || !client) return;

      void queryClient.invalidateQueries({
        predicate: predicateMatch(accountLayerQueryKeys.getUserSubAccounts, { user, chainId: client.config.chainId }),
      });
    },
  });
}
