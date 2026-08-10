"use client";

import {
  depositAndAllocateForAccountMutationOptions,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getCollateralAllowanceQueryKey,
  getCollateralBalanceQueryKey,
  type DepositAndAllocateForAccountParameters,
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
 * Parameters for {@link useDepositAndAllocate}.
 */
export type UseDepositAndAllocateParameters = WriteParameters;

/** Result returned by the {@link useDepositAndAllocate} mutation. */
export type DepositAndAllocateResult = WriteResult;

/** Return type of {@link useDepositAndAllocate}. */
export type UseDepositAndAllocateReturnType = UseMutationResult<
  DepositAndAllocateResult,
  SymmioRequestError,
  DepositAndAllocateForAccountParameters
>;

/**
 * Submit a `depositAndAllocateForAccount` transaction, crediting collateral to a
 * subaccount and allocating it into the **classic pool** in one transaction.
 * Instant trading spends the **available** balance instead — for the instant
 * flow fund with `useDeposit` alone (funds allocated here are not what an
 * instant open consumes). The connected wallet must own the subaccount, and must
 * have approved the collateral to the SYMMIO core first (see
 * `useApproveCollateral`). On success (after the receipt), the wallet's
 * collateral allowance + balance **and** the target subaccount's balance-info +
 * balance-of queries are invalidated — so a cross-margin (rasa/Base) UI sees the
 * new allocated margin without a manual refetch.
 *
 * @example
 * ```tsx
 * const { mutate, status, error } = useDepositAndAllocate();
 * mutate({ account: "0xsub…", amount: 1_000000n });
 * ```
 */
export function useDepositAndAllocate(
  parameters: UseDepositAndAllocateParameters = {},
): UseDepositAndAllocateReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const queryClient = useQueryClient();

  const base = depositAndAllocateForAccountMutationOptions(config);

  return useMutation<DepositAndAllocateResult, SymmioRequestError, DepositAndAllocateForAccountParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          account: variables.account,
          amount: variables.amount,
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
    onSuccess: (_result, variables) => {
      // Deposit side: the connected wallet's collateral allowance + balance drop.
      const walletPartial = address ? { owner: address } : undefined;
      void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralAllowanceQueryKey, walletPartial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralBalanceQueryKey, walletPartial) });
      // Allocate side: the target subaccount's allocated balance rises — refetch its
      // balance-info + balance-of so cross-margin (rasa/Base) reflects the new margin.
      const accountPartial = { account: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, accountPartial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, accountPartial) });
    },
  });
}
