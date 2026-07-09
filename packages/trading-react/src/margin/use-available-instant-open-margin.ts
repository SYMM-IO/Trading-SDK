"use client";

import { calculateAvailableInstantOpenMargin, PositionType, type ConfigParameter } from "@symmio/trading-core";
import { useCallback, useMemo } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { useAccountBalanceOf } from "../account-layer/use-account-balance-of";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useFeeForUser } from "../fees/use-fee-for-user";

/** Convert a slippage percent (e.g. `5`) to an 18-decimal fraction (`5e16`). */
function slippagePercentToFractionWei(slippage: number): bigint {
  return BigInt(Math.round(slippage * 1e16));
}

/** Parameters for {@link useAvailableInstantOpenMargin}. */
export interface UseAvailableInstantOpenMarginParameters extends ConfigParameter {
  /** SubAccount to spend margin from. The hook is idle until it is set. */
  account?: Address;
  /** Market symbol id, for the fee lookup. Idle until it is set. */
  symbolId?: bigint | number;
  /** Requested leverage (integer ≥ 1). */
  leverage: number;
  /** LONG skips the slippage cap; SHORT applies it. */
  positionType: PositionType;
  /** Slippage percent, e.g. `5`. */
  slippage: number;
  /** Optional chain override; defaults to the connected chain. */
  chainId?: number;
}

/** Return type of {@link useAvailableInstantOpenMargin}. */
export interface UseAvailableInstantOpenMarginReturnType {
  /** Spendable margin in 18-decimal wei; `undefined` until balance + fees load. */
  availableMarginWei: bigint | undefined;
  /** {@link UseAvailableInstantOpenMarginReturnType.availableMarginWei} as a decimal string; `"0"` when unavailable. */
  availableMargin: string;
  /** `true` while the underlying balance / fee reads are loading. */
  isLoading: boolean;
  /** First error from the balance / fee reads, if any. */
  error: SymmioRequestError | null;
  /** Refetch the underlying balance + fee reads (e.g. after an open/close settles). */
  refetch: () => Promise<void>;
}

/**
 * Maximum initial margin an instant open can spend for `account` on a market,
 * shaved for fees and — SHORT only — a worst-case slippage fill. Composes
 * {@link useAccountBalanceOf} + {@link useFeeForUser} and feeds them to
 * `calculateAvailableInstantOpenMargin`. Wire the result to the trade form's
 * `Max` chip and gate submit on it.
 *
 * @example
 * ```tsx
 * const { availableMargin, availableMarginWei } = useAvailableInstantOpenMargin({
 *   account: subAccount,
 *   symbolId: market.symbol_id,
 *   leverage,
 *   positionType,
 *   slippage,
 * });
 * ```
 */
export function useAvailableInstantOpenMargin(
  parameters: UseAvailableInstantOpenMarginParameters,
): UseAvailableInstantOpenMarginReturnType {
  const { account, symbolId, leverage, positionType, slippage, chainId, config } = parameters;

  // `live` keeps the shaved margin fresh: the balance refetches when an
  // open/close settles on-chain, so the Max chip drops without a manual refresh.
  const balanceQuery = useAccountBalanceOf({ account, chainId, config, live: true });
  const feeQuery = useFeeForUser({
    user: account ?? zeroAddress,
    symbolId: symbolId ?? 0,
    chainId,
    config,
    query: { enabled: Boolean(account && symbolId !== undefined) },
  });

  const { data: balance, isLoading: balanceLoading, error: balanceError, refetch: refetchBalance } = balanceQuery;
  const { data: fees, isLoading: feeLoading, error: feeError, refetch: refetchFees } = feeQuery;

  const refetch = useCallback(async () => {
    await Promise.all([refetchBalance(), refetchFees()]);
  }, [refetchBalance, refetchFees]);

  return useMemo<UseAvailableInstantOpenMarginReturnType>(() => {
    const isLoading = balanceLoading || feeLoading;
    const error = balanceError ?? feeError ?? null;

    if (balance === undefined || fees === undefined) {
      return { availableMarginWei: undefined, availableMargin: "0", isLoading, error, refetch };
    }

    const availableMarginWei = calculateAvailableInstantOpenMargin({
      balance,
      openFee: fees.openFee,
      closeFee: fees.closeFee,
      slippageFractionWei: slippagePercentToFractionWei(slippage),
      leverage,
      positionType,
    });

    return { availableMarginWei, availableMargin: formatUnits(availableMarginWei, 18), isLoading, error, refetch };
  }, [balance, balanceLoading, balanceError, fees, feeLoading, feeError, slippage, leverage, positionType, refetch]);
}
