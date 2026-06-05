"use client";

import {
  depositForAccountMutationOptions,
  getCollateralAllowanceQueryKey,
  getCollateralBalanceQueryKey,
  type DepositForAccountParameters,
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
 * Parameters for {@link useDeposit}.
 */
export type UseDepositParameters = WriteParameters;

/** Result returned by the {@link useDeposit} mutation. */
export type DepositResult = WriteResult;

/** Return type of {@link useDeposit}. */
export type UseDepositReturnType = UseMutationResult<DepositResult, SymmioRequestError, DepositForAccountParameters>;

/**
 * Submit a `depositForAccount` transaction, crediting collateral to a
 * subaccount's available balance. The connected wallet must own the subaccount,
 * and must have approved the collateral to the SYMMIO core first (see
 * `useApproveCollateral`). On success, the connected wallet's collateral
 * allowance and balance queries are invalidated so mounted reads refetch.
 *
 * @example
 * ```tsx
 * const { mutate, status, error } = useDeposit();
 * mutate({ account: "0xsub…", amount: 1_000000n });
 * ```
 */
export function useDeposit(parameters: UseDepositParameters = {}): UseDepositReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const queryClient = useQueryClient();

  const base = depositForAccountMutationOptions(config);

  return useMutation<DepositResult, SymmioRequestError, DepositForAccountParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          account: variables.account,
          amount: variables.amount,
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
      const partial = address ? { owner: address } : undefined;
      void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralAllowanceQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralBalanceQueryKey, partial) });
    },
  });
}
