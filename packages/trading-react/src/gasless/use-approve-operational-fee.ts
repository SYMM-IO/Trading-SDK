"use client";

import {
  approveOperationalFeeMutationOptions,
  getOperationalFeeAllowanceQueryKey,
  type ApproveOperationalFeeParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult } from "../transactions/resolve-write-result";
import type { WriteParameters, WriteResult } from "../transactions/write-types";
import { predicateMatch } from "../utils/predicate-match";

/** Parameters for {@link useApproveOperationalFee}. */
export type UseApproveOperationalFeeParameters = WriteParameters;

/** Mutation variables of {@link useApproveOperationalFee}: the core action's parameters. */
export type ApproveOperationalFeeVariables = ApproveOperationalFeeParameters;

/** Result of {@link useApproveOperationalFee}. */
export type ApproveOperationalFeeResult = WriteResult;

/** Return type of {@link useApproveOperationalFee}. */
export type UseApproveOperationalFeeReturnType = UseMutationResult<
  ApproveOperationalFeeResult,
  SymmioRequestError,
  ApproveOperationalFeeVariables
>;

/**
 * Approve operational-fee allowances for the gasless fee charger, as the
 * paying sub-account (via the AccountLayer `_call` proxy).
 *
 * Grant the allowance **before** relying on gasless execution. This is a
 * normal on-chain write — pass `gasless: true` in the variables to relay the
 * approval itself once gasless execution is active. On success the allowance
 * read is invalidated after the receipt.
 *
 * @example
 * ```tsx
 * const approve = useApproveOperationalFee();
 * approve.mutate({ account: subAccount, amounts: [maxUint256] });
 * ```
 */
export function useApproveOperationalFee(
  parameters: UseApproveOperationalFeeParameters = {},
): UseApproveOperationalFeeReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = approveOperationalFeeMutationOptions(config);

  return useMutation<ApproveOperationalFeeResult, SymmioRequestError, ApproveOperationalFeeVariables>({
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
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getOperationalFeeAllowanceQueryKey, { payer: variables.account }),
      });
    },
  });
}
