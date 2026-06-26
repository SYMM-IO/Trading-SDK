"use client";

import {
  approveCollateralMutationOptions,
  getCollateralAllowanceQueryKey,
  type ApproveCollateralParameters,
} from "@theoldvarorg/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useApproveCollateral}.
 */
export type UseApproveCollateralParameters = WriteParameters;

/** Result returned by the {@link useApproveCollateral} mutation. */
export type ApproveCollateralResult = WriteResult;

/** Return type of {@link useApproveCollateral}. */
export type UseApproveCollateralReturnType = UseMutationResult<
  ApproveCollateralResult,
  SymmioRequestError,
  ApproveCollateralParameters
>;

/**
 * Submit an ERC20 `approve` of the collateral token to the SYMMIO core — the
 * prerequisite for `useDeposit` / `useDepositAndAllocate`. On success, the
 * connected wallet's collateral allowance query is invalidated so a gating
 * "needs approval" check refetches.
 *
 * @example
 * ```tsx
 * import { maxUint256 } from "viem";
 * const { mutate, status, error } = useApproveCollateral();
 * mutate({ amount: maxUint256 });
 * ```
 */
export function useApproveCollateral(parameters: UseApproveCollateralParameters = {}): UseApproveCollateralReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const { address } = useConnection();
  const queryClient = useQueryClient();

  const base = approveCollateralMutationOptions(config);

  return useMutation<ApproveCollateralResult, SymmioRequestError, ApproveCollateralParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
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
    onSuccess: () => {
      const partial = address ? { owner: address } : undefined;
      void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralAllowanceQueryKey, partial) });
    },
  });
}
