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
  getWithdrawRouteChoicesQueryKey,
  getWithdrawRouteQueryKey,
  SymmError,
  withdrawWithExpressMutationOptions,
  type WithdrawRoute,
  type WithdrawWithExpressParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type QueryClient, type UseMutationResult } from "@tanstack/react-query";
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
  /**
   * Exact request id decoded from `WithdrawInitiated`. On the immediate classic
   * route the same receipt also finalized this request: when it finalized
   * another one instead, the hook rejects with `WITHDRAW_REQUEST_NOT_FINALIZED`
   * and this request stays pending. Recover it through
   * `usePendingWithdrawRequests` plus `useFinalizeWithdrawRequest` or
   * `useRequestCancelWithdraw`.
   */
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
 * The immediate classic route (`kind: "classic"`, `finalize: "immediate"`)
 * batches `initiateWithdraw` with a finalize of the guessed next request id, so
 * a concurrent request on the same subaccount can be finalized in place of the
 * new one. The hook therefore requires the receipt to finalize the request it
 * initiated, and otherwise rejects with
 * `SymmioRequestError { kind: "sdk", code: "WITHDRAW_REQUEST_NOT_FINALIZED" }`
 * instead of reporting a completed withdrawal. The new request stays pending:
 * list it with `usePendingWithdrawRequests`, then finalize it with
 * `useFinalizeWithdrawRequest` or cancel it with `useRequestCancelWithdraw`.
 *
 * The withdrawal reads are refreshed after every mined transaction, including
 * one whose receipt check then rejects, because its balance and request changes
 * already landed on-chain.
 *
 * @param parameters - Subaccount, optional chain/config, and confirmations.
 * @returns A mutation whose result includes hash, receipt, request id, and route.
 *
 * @example
 * ```tsx
 * const withdraw = useWithdrawWithExpress({ account: subAccount });
 * withdraw.mutate({ amount, receiver });
 * // The request was initiated but not finalized: finalize or cancel it from the pending list.
 * const stranded = withdraw.error?.code === "WITHDRAW_REQUEST_NOT_FINALIZED";
 * ```
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
      const account = parameters.account;
      /**
       * Set once a successful receipt is in hand. A receipt check that throws
       * after that point still leaves a mined withdrawal behind, so the catch
       * refreshes the withdrawal reads before rejecting.
       */
      let mined = false;
      try {
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
        mined = true;
        const requestId = getWithdrawRequestIdFromReceipt(settled.receipt, {
          user: account,
          symmioAddress: config.getChainConfig(chainId).addresses.symmioAddress,
          requireFinalized: submitted.route.kind === "classic" && submitted.route.finalize === "immediate",
        });
        return { hash: submitted.hash, receipt: settled.receipt, requestId, route: submitted.route };
      } catch (err) {
        if (mined && account) refreshWithdrawalQueries(queryClient, account);
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      const account = parameters.account;
      if (!account) return;
      refreshWithdrawalQueries(queryClient, account);
    },
  });
}

/**
 * Refresh every cached read a mined withdrawal can change. The subaccount's
 * balances, withdraw requests, last request id, and withdrawable time are
 * invalidated; its route previews and Express options are removed, because the
 * offers they hold no longer describe the account.
 *
 * @param queryClient - The active TanStack query client.
 * @param account - Subaccount the withdrawal debited.
 */
function refreshWithdrawalQueries(queryClient: QueryClient, account: Address): void {
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
  queryClient.removeQueries({ predicate: predicateMatch(getWithdrawRouteChoicesQueryKey, withdrawPartial) });
}
