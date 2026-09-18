"use client";

import {
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getExpressWithdrawOptionsQueryKey,
  getLastWithdrawRequestIdQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  getWithdrawRequestIdFromReceipt,
  getWithdrawRequestsQueryKey,
  getWithdrawRouteQueryKey,
  SymmError,
  withdrawWithExpressMutationOptions,
  type WithdrawRoute,
  type WithdrawWithExpressParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { Address, Hash, TransactionReceipt } from "viem";
import { useSubAccount } from "../account-layer/use-sub-account";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters } from "../transactions";
import { predicateMatch } from "../utils";

/** Parameters for {@link useWithdrawWithExpress}. */
export type UseWithdrawWithExpressParameters = Omit<WriteParameters, "waitForReceipt"> & {
  /** Subaccount to withdraw from. */
  account?: Address;
  /** Target chain; defaults to the connected chain. */
  chainId?: number;
};

/** Mutation variables for {@link useWithdrawWithExpress}. */
export type WithdrawWithExpressVariables = Omit<WithdrawWithExpressParameters, "account" | "chainId" | "isolationType">;

/** Successful receipt, request id, and route returned by {@link useWithdrawWithExpress}. */
export interface WithdrawWithExpressResult {
  /** Submitted transaction hash. */
  hash: Hash;
  /** Successful mined transaction receipt. */
  receipt: TransactionReceipt;
  /** Exact request id decoded from `WithdrawInitiated`. */
  requestId: bigint;
  /** Route used by the mutation. */
  route: WithdrawRoute;
}

/** Return type of {@link useWithdrawWithExpress}. */
export type UseWithdrawWithExpressReturnType = UseMutationResult<
  WithdrawWithExpressResult,
  SymmioRequestError,
  WithdrawWithExpressVariables
>;

/**
 * Execute an Express-aware withdrawal and wait for its initiation receipt.
 *
 * The hook resolves isolation through `useSubAccount`, forwards every mutation
 * variable to core, decodes the emitted request id, and refreshes all affected
 * account/withdrawal reads. Pass `preparedRoute` to submit the exact route shown
 * by {@link useWithdrawRoute}.
 *
 * @param parameters - Subaccount, optional chain/config, and confirmations.
 * @returns A mutation whose result includes hash, receipt, request id, and route.
 */
export function useWithdrawWithExpress(
  parameters: UseWithdrawWithExpressParameters = {},
): UseWithdrawWithExpressReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? connectedChainId;
  const queryClient = useQueryClient();
  const { data: subAccount } = useSubAccount({ account: parameters.account, chainId, config });
  const base = withdrawWithExpressMutationOptions(config);

  return useMutation<WithdrawWithExpressResult, SymmioRequestError, WithdrawWithExpressVariables>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const account = parameters.account;
        if (!account) {
          throw new SymmError(
            "validation",
            "MISSING_ACCOUNT",
            "useWithdrawWithExpress: `account` must be set on the hook.",
          );
        }
        const submitted = await base.mutationFn({
          ...variables,
          account,
          chainId,
          isolationType: subAccount?.isolationType,
        });
        const settled = await resolveWriteResult(config, submitted.hash, {
          chainId,
          waitForReceipt: true,
          confirmations: parameters.confirmations,
        });
        if (!settled.receipt) {
          throw new SymmError("validation", "WITHDRAW_RECEIPT_MISSING", "Withdrawal receipt was not returned.");
        }
        const requestId = getWithdrawRequestIdFromReceipt(settled.receipt, {
          user: account,
          symmioAddress: config.getChainConfig(chainId).addresses.symmioAddress,
        });
        return { hash: submitted.hash, receipt: settled.receipt, requestId, route: submitted.route };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      const account = parameters.account;
      if (!account) return;

      const balancePartial = { account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, balancePartial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, balancePartial) });

      const withdrawPartial = { user: account };
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getPendingWithdrawRequestsQueryKey, withdrawPartial),
      });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getWithdrawRequestsQueryKey, withdrawPartial) });
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getLastWithdrawRequestIdQueryKey, withdrawPartial),
      });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getWithdrawableTimeQueryKey, withdrawPartial) });

      queryClient.removeQueries({ predicate: predicateMatch(getExpressWithdrawOptionsQueryKey, withdrawPartial) });
      queryClient.removeQueries({ predicate: predicateMatch(getWithdrawRouteQueryKey, withdrawPartial) });
    },
  });
}
