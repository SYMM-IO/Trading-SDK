"use client";

import { editAccountName, SymmError, type EditAccountNameParams } from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { Account, Chain, Hash, Transport, WalletClient } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useSymmioPublicClient } from "../provider/use-symmio-public-client";
import { useSymmioWalletClient } from "../provider/use-symmio-wallet-client";
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
 * Result returned by {@link useEditAccountName}'s mutation.
 */
export interface EditAccountNameResult {
  /** The submitted transaction hash. */
  hash: Hash;
  /** The mined receipt, present when `waitForReceipt` is enabled. */
  receipt?: Awaited<ReturnType<NonNullable<ReturnType<typeof useSymmioPublicClient>>["waitForTransactionReceipt"]>>;
}

/**
 * Submit an `editAccountName` transaction for the user's subaccount.
 *
 * The mutation grabs a wallet client for the SDK's configured chain via the
 * host's wagmi config; you do not pass a client. After success, the
 * `getUserSubAccounts` query is invalidated for the SDK's active chain so any
 * mounted list rerenders with the new name on the next refetch.
 *
 * @example
 * const { mutate, status, error } = useEditAccountName();
 * <button onClick={() => mutate({ account: "0xsub...", name: "Trading Bot" })}>
 *   Rename
 * </button>
 */
export function useEditAccountName(
  options?: UseEditAccountNameOptions,
): UseMutationResult<EditAccountNameResult, SymmioRequestError, EditAccountNameParams> {
  const config = useSymmioConfig();
  const walletClientQuery = useSymmioWalletClient();
  const publicClient = useSymmioPublicClient();
  const queryClient = useQueryClient();

  const waitForReceipt = options?.waitForReceipt ?? true;
  const confirmations = options?.confirmations ?? 1;

  return useMutation<EditAccountNameResult, SymmioRequestError, EditAccountNameParams>({
    mutationFn: async (params) => {
      const walletClient = walletClientQuery.data;

      if (!walletClient) {
        throw normalizeSymmError(new SymmError("Wallet not connected, or wallet is on a different chain."));
      }
      if (!publicClient) {
        throw normalizeSymmError(new SymmError("No public client available for the configured chain."));
      }

      try {
        const hash = await editAccountName(walletClient as WalletClient<Transport, Chain, Account>, {
          account: params.account,
          name: params.name,
          accountLayerAddress: params.accountLayerAddress ?? config.addresses.accountLayerAddress,
        });

        if (!waitForReceipt) return { hash };

        const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations });
        return { hash, receipt };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...accountLayerQueryKeys.all, "getUserSubAccounts"],
      });
    },
  });
}
