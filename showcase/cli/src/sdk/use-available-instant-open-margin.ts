import {
  calculateAvailableForOrder,
  calculateAvailableInstantOpenMargin,
  calculateQuoteUpnlWei,
  isActivePosition,
  SubAccountIsolationType,
  type PositionType,
} from "@symmio/trading-core";
import { useCallback, useMemo } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAvailableBalance, useBalanceInfo } from "./use-balances.js";
import { useManagedPositions } from "./use-managed-positions.js";
import { useFeeForUser } from "./use-market-data.js";
import { useMarkets } from "./use-markets.js";
import { useLivePrices } from "./use-prices.js";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSubAccount } from "./use-sub-accounts.js";

/** Rasa keeps 10% of a CUSTOM account's available-for-order balance reserved. */
const RASA_SPENDABLE_BPS = 9_000n;

/** Convert a slippage percentage (`5`) to an 18-decimal fraction (`0.05e18`). */
function slippagePercentToFractionWei(slippage: number): bigint {
  return BigInt(Math.round(slippage * 1e16));
}

export interface UseAvailableInstantOpenMarginParameters {
  /** Market id used to read the account's open and close fee rates. */
  symbolId?: number;
  /** Requested integer leverage. */
  leverage: number;
  /** LONG skips the slippage reserve; SHORT applies it. */
  positionType: PositionType;
  /** Slippage percentage, e.g. `5` for 5%. */
  slippage: number;
  /** Disable all account-specific reads while the surrounding form is idle. */
  enabled?: boolean;
}

export interface AvailableInstantOpenMargin {
  /** Spendable margin in 18-decimal wei; undefined until every required input is available. */
  availableMarginWei: bigint | undefined;
  /** Decimal representation of `availableMarginWei`, or `"0"` while unavailable. */
  availableMargin: string;
  /** Whether account discovery or a required balance, fee, position, or market read is loading. */
  isLoading: boolean;
  /** First dependency error, or null. */
  error: unknown;
  /** Refresh the reads used by the active isolation model. */
  refetch: () => Promise<void>;
}

/**
 * Maximum initial margin the selected sub-account can spend on an instant open.
 * VA isolation shaves available balance for round-trip fees and SHORT
 * slippage. CUSTOM isolation values every active position against its live mark
 * price, feeds the exact signed bigint uPnL into `calculateAvailableForOrder`,
 * and applies Rasa's 90% spendable policy.
 */
export function useAvailableInstantOpenMargin({
  symbolId,
  leverage,
  positionType,
  slippage,
  enabled = true,
}: UseAvailableInstantOpenMarginParameters): AvailableInstantOpenMargin {
  const { solverId } = useSdkScope();
  const subAccountState = useSubAccount();
  const { subAccount, subAccountDetail } = subAccountState;
  const isolationType = enabled && subAccount ? subAccountDetail?.isolationType : undefined;
  const isolationKnown = isolationType !== undefined;
  const isCrossMargin = isolationType === SubAccountIsolationType.CUSTOM;
  const vaAccount = enabled && isolationKnown && !isCrossMargin ? subAccount : undefined;
  const customAccount = enabled && isCrossMargin ? subAccount : undefined;

  const balance = useAvailableBalance(vaAccount);
  const fees = useFeeForUser(vaAccount, vaAccount && symbolId !== undefined ? symbolId : undefined);
  const balanceInfo = useBalanceInfo(customAccount);
  const managed = useManagedPositions(enabled && isCrossMargin);
  const markets = useMarkets();
  const { prices } = useLivePrices();

  const activePositions = useMemo(
    () =>
      isCrossMargin
        ? managed.quotes.filter(
            (quote) =>
              isActivePosition(quote) &&
              quote.openQuantity > 0n &&
              (quote.openedPrice ?? quote.requestedOpenPrice) > 0n,
          )
        : [],
    [isCrossMargin, managed.quotes],
  );

  const marketNameById = useMemo(() => {
    const result = new Map<string, string>();
    for (const market of markets.data ?? []) result.set(String(market.symbolId), market.name);
    return result;
  }, [markets.data]);

  /** Undefined means at least one live position is not priced; never return a partial account sum. */
  const accountUpnl = useMemo<bigint | undefined>(() => {
    if (!isCrossMargin) return undefined;
    if (activePositions.length === 0) return 0n;

    let total = 0n;
    for (const position of activePositions) {
      const marketName = marketNameById.get(String(position.symbolId));
      const markPriceDecimal = marketName ? prices.get(marketName) : undefined;
      if (markPriceDecimal === undefined) return undefined;

      let markPrice: bigint;
      try {
        markPrice = parseUnits(markPriceDecimal, 18);
      } catch {
        return undefined;
      }

      total += calculateQuoteUpnlWei({
        positionType: position.positionType,
        openQuantity: position.openQuantity,
        openedPrice: position.openedPrice ?? position.requestedOpenPrice,
        markPrice,
      });
    }
    return total;
  }, [activePositions, isCrossMargin, marketNameById, prices]);

  const refetch = useCallback(async () => {
    if (isCrossMargin) {
      managed.refetch();
      await Promise.all([balanceInfo.refetch(), markets.refetch()]);
      return;
    }
    await Promise.all([balance.refetch(), fees.refetch()]);
  }, [balance, balanceInfo, fees, isCrossMargin, managed, markets]);

  return useMemo<AvailableInstantOpenMargin>(() => {
    const isolationLoading = enabled && (subAccountState.isLoading || (Boolean(subAccount) && !isolationKnown));

    if (!enabled) {
      return { availableMarginWei: undefined, availableMargin: "0", isLoading: false, error: null, refetch };
    }

    if (isCrossMargin) {
      const isLoading = isolationLoading || balanceInfo.isLoading || managed.isLoading || markets.isLoading;
      const error = subAccountState.error ?? balanceInfo.error ?? managed.error ?? markets.error ?? null;

      if (balanceInfo.data === undefined || accountUpnl === undefined) {
        return { availableMarginWei: undefined, availableMargin: "0", isLoading, error, refetch };
      }

      const availableForOrder = calculateAvailableForOrder({ balanceInfo: balanceInfo.data, upnl: accountUpnl });
      const clamped = availableForOrder > 0n ? availableForOrder : 0n;
      const availableMarginWei = solverId === "rasa" ? (clamped * RASA_SPENDABLE_BPS) / 10_000n : clamped;

      return {
        availableMarginWei,
        availableMargin: formatUnits(availableMarginWei, 18),
        isLoading,
        error,
        refetch,
      };
    }

    const isLoading = isolationLoading || balance.isLoading || fees.isLoading;
    const error = subAccountState.error ?? balance.error ?? fees.error ?? null;

    if (!isolationKnown || balance.data === undefined || fees.data === undefined) {
      return { availableMarginWei: undefined, availableMargin: "0", isLoading, error, refetch };
    }

    const availableMarginWei = calculateAvailableInstantOpenMargin({
      balance: balance.data,
      openFee: fees.data.openFee,
      closeFee: fees.data.closeFee,
      slippageFractionWei: slippagePercentToFractionWei(slippage),
      leverage,
      positionType,
    });

    return {
      availableMarginWei,
      availableMargin: formatUnits(availableMarginWei, 18),
      isLoading,
      error,
      refetch,
    };
  }, [
    enabled,
    subAccountState.isLoading,
    subAccountState.error,
    subAccount,
    isolationKnown,
    isCrossMargin,
    solverId,
    balance.data,
    balance.isLoading,
    balance.error,
    fees.data,
    fees.isLoading,
    fees.error,
    balanceInfo.data,
    balanceInfo.isLoading,
    balanceInfo.error,
    managed.isLoading,
    managed.error,
    markets.isLoading,
    markets.error,
    accountUpnl,
    slippage,
    leverage,
    positionType,
    refetch,
  ]);
}
