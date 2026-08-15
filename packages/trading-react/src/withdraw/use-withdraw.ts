"use client";

import {
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  SymmError,
  withdrawAutoMutationOptions,
  type WithdrawAutoParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { Address } from "viem";
import { useSubAccount } from "../account-layer/use-sub-account";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useWithdraw}. `account` (the subaccount) and `chainId` are
 * read at hook time so the hook can resolve the subaccount's isolation type via
 * {@link useSubAccount}; the per-withdraw inputs (`amount`, `receiver`, …) are the
 * mutation variables.
 */
export type UseWithdrawParameters = WriteParameters & {
  /** The subaccount to withdraw from. The connected wallet must be its on-chain owner. */
  account?: Address;
  /** Target chain id. Defaults to the connected chain. */
  chainId?: number;
};

/**
 * Variables for the {@link useWithdraw} mutation — the per-withdraw inputs, with
 * `amount` in the **collateral token's decimals**. `account`, `chainId`, and
 * `isolationType` are supplied by the hook, so the caller never passes them (nor
 * `parts`). `upnlSig` is optional; on the `CUSTOM` path a fresh Muon uPnL signature
 * is fetched for the deallocate leg when omitted.
 */
export type UseWithdrawVariables = Omit<WithdrawAutoParameters, "account" | "isolationType" | "chainId">;

/** Result returned by the {@link useWithdraw} mutation. */
export type WithdrawResult = WriteResult;

/** Return type of {@link useWithdraw}. */
export type UseWithdrawReturnType = UseMutationResult<WithdrawResult, SymmioRequestError, UseWithdrawVariables>;

/**
 * Withdraw from a subaccount from a **minimal, collateral-decimals input** — the
 * high-level entry point that hides isolation, parts, and amount scaling.
 *
 * Pass the `account` (and optional `chainId`) to the hook; call `mutate` with just
 * `{ amount, receiver }`. The hook reads the subaccount's `isolationType` with
 * {@link useSubAccount} (deduped with any other `useSubAccount` on the same key —
 * e.g. one already driving a balance display) and hands it to the SDK, so the core
 * action skips a redundant on-chain read and picks the path: a `CUSTOM`
 * (cross-margin) subaccount deallocates then initiates in one atomic transaction; a
 * `MARKET` / `MARKET_DIRECTION` (VA / lowcap) subaccount only initiates the withdraw
 * request. On a cache miss the core action resolves `isolationType` itself.
 *
 * `amount` is in the **collateral token's decimals** (e.g. 6 for USDC). The hook
 * builds the classic same-chain withdraw part from it and, on the `CUSTOM` path,
 * scales it to the 18-decimal amount the deallocate leg needs — the caller does not
 * scale anything.
 *
 * On success, the subaccount's balance reads (`balanceInfo`, `balanceOf`) and its
 * pending-requests / withdrawable-time reads are invalidated.
 *
 * @remarks
 * On the `CUSTOM` path the SDK fetches a fresh Muon uPnL signature for the
 * deallocate leg unless you pass one as `upnlSig`; that leg is subject to the
 * on-chain deallocate debounce. Failures surface as a normalized
 * {@link SymmioRequestError}. Reach for `useDeallocateAndInitiateWithdraw` /
 * `useInitiateWithdraw` when you already know the isolation and want to drive one
 * specific path, or need custom (multi-part / cross-chain) withdraw parts.
 *
 * @example
 * ```tsx
 * const { mutate } = useWithdraw({ account: "0xsub…" });
 * // amount in the collateral token's decimals (6-dec USDC → 1 USDC):
 * mutate({ amount: 1_000000n, receiver: "0xabc…" });
 * ```
 */
export function useWithdraw(parameters: UseWithdrawParameters = {}): UseWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const resolvedChainId = parameters.chainId ?? chainId;

  // Resolve the subaccount's isolation type via the standard hook (deduped by
  // react-query with any other useSubAccount on the same key), so the core action
  // skips a redundant getSubAccount RPC.
  const { data: subAccount } = useSubAccount({ account: parameters.account, chainId: parameters.chainId });
  const isolationType = subAccount?.isolationType;

  const base = withdrawAutoMutationOptions(config);

  return useMutation<WithdrawResult, SymmioRequestError, UseWithdrawVariables>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const account = parameters.account;
        if (!account) {
          throw new SymmError("validation", "MISSING_ACCOUNT", "useWithdraw: `account` must be set on the hook.");
        }
        const hash = await base.mutationFn({ ...variables, account, chainId: resolvedChainId, isolationType });
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
      const account = parameters.account;
      if (!account) return;

      const balancePartial = { account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, balancePartial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, balancePartial) });

      const withdrawPartial = { user: account };
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getPendingWithdrawRequestsQueryKey, withdrawPartial),
      });
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getWithdrawableTimeQueryKey, withdrawPartial),
      });
    },
  });
}
