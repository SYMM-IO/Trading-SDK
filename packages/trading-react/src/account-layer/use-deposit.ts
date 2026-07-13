"use client";

import {
  depositForAccountMutationOptions,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getCollateralAllowanceQueryKey,
  getCollateralBalanceQueryKey,
  type DepositForAccountParameters,
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
 * allowance and balance queries **and the credited subaccount's available
 * balance** are invalidated, so mounted reads — including the trade form's
 * available instant-open margin (`Max`) — refetch immediately.
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
      const partial = address ? { owner: address } : undefined;
      void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralAllowanceQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralBalanceQueryKey, partial) });
      // The deposit credits the subaccount's available balance — refetch it so
      // the trade form's available margin / `Max` reflect the new funds. A
      // deposit is not a trade settle, so `live` balance reads don't otherwise
      // refetch on their own.
      const accountPartial = { account: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, accountPartial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, accountPartial) });
    },
  });
}
