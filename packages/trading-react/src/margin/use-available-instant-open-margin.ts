"use client";

import {
  calculateAvailableForOrder,
  calculateAvailableInstantOpenMargin,
  PositionType,
  SubAccountIsolationType,
  type ConfigParameter,
  type SolverId,
} from "@symmio/trading-core";
import { useCallback, useMemo } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { useAccountBalanceInfo } from "../account-layer/use-account-balance-info";
import { useAccountBalanceOf } from "../account-layer/use-account-balance-of";
import { useSubAccount } from "../account-layer/use-sub-account";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useFeeForUser } from "../fees/use-fee-for-user";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useAccountUpnl } from "../quotes/use-account-upnl";
import { useOffchainPendingLocked } from "../quotes/use-offchain-pending-locked";

/** Convert a slippage percent (e.g. `5`) to an 18-decimal fraction (`5e16`). */
function slippagePercentToFractionWei(slippage: number): bigint {
  return BigInt(Math.round(slippage * 1e16));
}

/**
 * **Rasa-specific policy**: the fraction of a cross-margin account's
 * `availableForOrder` a new open may spend, in basis points (90%). The
 * remaining 10% stays as a safety buffer so a fill at a slightly worse price
 * or a fee charge cannot tip the account straight into deficiency.
 *
 * Applied only when the resolved solver is Rasa — a future cross-margin solver
 * spends 100% unless its vendor mandates its own buffer.
 */
const RASA_SPENDABLE_BPS = 9_000n;

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
  /**
   * Solver whose markets and price provider value the cross-margin uPnL.
   * Defaults to the chain's default solver. The margin **model** is not chosen
   * here — it follows the sub-account's isolation type.
   */
  solverId?: SolverId;
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
 * Maximum initial margin an instant open can spend for `account` on a market —
 * **the** margin hook. The margin model follows the sub-account's isolation
 * type:
 *
 * - **VA isolations** (`POSITION` / `MARKET` / `MARKET_DIRECTION`): the
 *   sub-account's available balance shaved for fees and — SHORT only — a
 *   worst-case slippage fill (`calculateAvailableInstantOpenMargin` over
 *   {@link useAccountBalanceOf} + {@link useFeeForUser}).
 * - **`CUSTOM` (cross-margin)** — trades execute on the sub-account directly:
 *   `calculateAvailableForOrder` over the live `balanceInfoOfPartyA` snapshot
 *   and the account's SDK-computed uPnL ({@link useAccountUpnl} — Σ
 *   per-position uPnL against live mark prices), clamped at zero. **On the
 *   Rasa solver only**, 90% of it is spendable — a 10% buffer stays reserved
 *   (see `RASA_SPENDABLE_BPS`); other cross-margin solvers spend 100%.
 *
 * Every read is live: balances refetch on on-chain settle notifications and
 * the cross-margin uPnL streams off the price socket, so the `Max` chip tracks
 * trades and the market without manual refreshes. Wire the result to the trade
 * form's `Max` chip and gate submit on it.
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
  const { account, symbolId, leverage, positionType, slippage, solverId, chainId, config } = parameters;

  // The 10% spend buffer is a RASA policy, not a cross-margin-model rule —
  // resolved by solver id so a future cross-margin solver is unaffected.
  const resolvedConfig = useSymmioConfig(parameters);
  const isRasaSolver = resolvedConfig.getSolver({ chainId, solverId }).id === "rasa";

  // The margin model follows the sub-account's isolation: `CUSTOM` trades on
  // the sub-account directly (cross-margin); the VA isolations spend the
  // sub-account's available balance. Isolation is fixed at creation, so this
  // read caches indefinitely.
  const subAccountQuery = useSubAccount({
    account: account ?? zeroAddress,
    chainId,
    config,
    query: { enabled: Boolean(account), staleTime: Infinity },
  });
  const isolationType = account !== undefined ? subAccountQuery.data?.isolationType : undefined;
  const isolationKnown = isolationType !== undefined;
  const isCrossMargin = isolationType === SubAccountIsolationType.CUSTOM;

  // `live` keeps the margin fresh: balances refetch when an open/close settles
  // on-chain, so the Max chip drops without a manual refresh.
  const balanceQuery = useAccountBalanceOf({
    account,
    chainId,
    config,
    live: true,
    query: { enabled: isolationKnown && !isCrossMargin },
  });
  const feeQuery = useFeeForUser({
    user: account ?? zeroAddress,
    symbolId: symbolId ?? 0,
    chainId,
    config,
    query: { enabled: isolationKnown && !isCrossMargin && Boolean(account && symbolId !== undefined) },
  });
  const balanceInfoQuery = useAccountBalanceInfo({
    account,
    chainId,
    config,
    live: true,
    query: { enabled: isCrossMargin && Boolean(account) },
  });
  const accountUpnl = useAccountUpnl({ account, chainId, solverId, config, enabled: isCrossMargin, live: true });
  const offchainLocked = useOffchainPendingLocked({ account, chainId, enabled: isCrossMargin, live: true });
  const { data: balance, isLoading: balanceLoading, error: balanceError, refetch: refetchBalance } = balanceQuery;
  const { data: fees, isLoading: feeLoading, error: feeError, refetch: refetchFees } = feeQuery;
  const {
    data: balanceInfo,
    isLoading: balanceInfoLoading,
    error: balanceInfoError,
    refetch: refetchBalanceInfo,
  } = balanceInfoQuery;
  const { upnl, isLoading: upnlLoading, refetch: refetchUpnl } = accountUpnl;
  const { offchainPendingLocked, refetch: refetchOffchainLocked } = offchainLocked;

  const refetch = useCallback(async () => {
    if (isCrossMargin) {
      refetchOffchainLocked();
      await Promise.all([refetchBalanceInfo(), refetchUpnl()]);
      return;
    }
    await Promise.all([refetchBalance(), refetchFees()]);
  }, [isCrossMargin, refetchBalance, refetchFees, refetchBalanceInfo, refetchUpnl, refetchOffchainLocked]);

  return useMemo<UseAvailableInstantOpenMarginReturnType>(() => {
    const isolationLoading = Boolean(account) && !isolationKnown;

    if (isCrossMargin) {
      const isLoading = balanceInfoLoading || upnlLoading;
      const error = balanceInfoError ?? null;

      if (balanceInfo === undefined || upnl === undefined) {
        return { availableMarginWei: undefined, availableMargin: "0", isLoading, error, refetch };
      }

      const available = calculateAvailableForOrder({ balanceInfo, upnl, offchainPendingLocked });
      const clamped = available > 0n ? available : 0n;
      // Rasa-only 10% spend buffer — see RASA_SPENDABLE_BPS.
      const availableMarginWei = isRasaSolver ? (clamped * RASA_SPENDABLE_BPS) / 10_000n : clamped;
      return { availableMarginWei, availableMargin: formatUnits(availableMarginWei, 18), isLoading, error, refetch };
    }

    const isLoading = isolationLoading || balanceLoading || feeLoading;
    const error = balanceError ?? feeError ?? null;

    if (!isolationKnown || balance === undefined || fees === undefined) {
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
  }, [
    account,
    isolationKnown,
    isCrossMargin,
    isRasaSolver,
    balance,
    balanceLoading,
    balanceError,
    fees,
    feeLoading,
    feeError,
    balanceInfo,
    balanceInfoLoading,
    balanceInfoError,
    upnl,
    offchainPendingLocked,
    upnlLoading,
    slippage,
    leverage,
    positionType,
    refetch,
  ]);
}
