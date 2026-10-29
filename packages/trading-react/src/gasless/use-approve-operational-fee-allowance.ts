"use client";

import {
  approveOperationalFeeAllowanceMutationOptions,
  getOperationalFeeAllowanceQueryKey,
  type ApproveOperationalFeeAllowanceParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeProtectedWriteError } from "../errors/normalize-protected-write-error";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult } from "../transactions/resolve-write-result";
import type { WriteParameters, WriteResult } from "../transactions/write-types";
import { predicateMatch } from "../utils/predicate-match";

/** Parameters for {@link useApproveOperationalFeeAllowance}. */
export type UseApproveOperationalFeeAllowanceParameters = WriteParameters;

/** Mutation variables of {@link useApproveOperationalFeeAllowance}: the core action's parameters. */
export type ApproveOperationalFeeAllowanceVariables = ApproveOperationalFeeAllowanceParameters;

/** Result of {@link useApproveOperationalFeeAllowance}. */
export type ApproveOperationalFeeAllowanceResult = WriteResult;

/** Return type of {@link useApproveOperationalFeeAllowance}. */
export type UseApproveOperationalFeeAllowanceReturnType = UseMutationResult<
  ApproveOperationalFeeAllowanceResult,
  SymmioRequestError,
  ApproveOperationalFeeAllowanceVariables
>;

/**
 * Set operational-fee allowances for the gasless fee charger, as the paying
 * sub-account, without touching the fee multiplier — the diamond's
 * two-argument `approveOperationalFee`.
 *
 * Prefer {@link useApproveOperationalFee} by default. Use this one when a
 * multiplier set elsewhere must survive, or when the signer is a session key
 * whose delegation holds only this function's selector. Pass `gasless: true`
 * (and `from` for a session key) in the variables to relay it. On success the
 * allowance read is invalidated after the receipt, so
 * `useOperationalFeeAllowance` reads the new value back.
 *
 * `amounts` are **18-decimal Core units**, and each one replaces the current
 * allowance.
 *
 * @example
 * ```tsx
 * import { parseUnits } from "viem";
 *
 * const approve = useApproveOperationalFeeAllowance();
 * approve.mutate({ account: subAccount, amounts: [parseUnits("5", 18)], from: sessionKey, gasless: true });
 * ```
 */
export function useApproveOperationalFeeAllowance(
  parameters: UseApproveOperationalFeeAllowanceParameters = {},
): UseApproveOperationalFeeAllowanceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = approveOperationalFeeAllowanceMutationOptions(config);

  return useMutation<ApproveOperationalFeeAllowanceResult, SymmioRequestError, ApproveOperationalFeeAllowanceVariables>(
    {
      mutationKey: base.mutationKey,
      mutationFn: async (variables) => {
        try {
          const resolvedChainId = variables.chainId ?? chainId;
          const hash = await base.mutationFn({ ...variables, chainId: resolvedChainId });
          const result = resolveWriteResult(config, hash, {
            chainId: resolvedChainId,
            waitForReceipt: parameters.waitForReceipt,
            confirmations: parameters.confirmations,
          });
          return variables.timelock ? await result : result;
        } catch (err) {
          throw variables.timelock ? normalizeProtectedWriteError(err, variables.timelock) : normalizeSymmError(err);
        }
      },
      onSuccess: (_result, variables) => {
        void queryClient.invalidateQueries({
          predicate: predicateMatch(getOperationalFeeAllowanceQueryKey, { payer: variables.account }),
        });
      },
    },
  );
}
