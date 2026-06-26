"use client";

import {
  calculateLiquidationPrice,
  PositionType,
  type ConfigParameter,
  type AccountPosition,
} from "@symm-frontier/core";
import { useMemo } from "react";
import { useAccountBalanceInfo } from "../account-layer/use-account-balance-info";
import { usePartyAOpenPositions } from "./use-party-a-open-positions";
import type { Address } from "viem";

/**
 * Parameters for {@link useAccountLiquidationPrice}.
 */
export interface UseAccountLiquidationPriceParameters extends ConfigParameter {
  /** Account address (a sub-account for Majors, a virtual account for lowcap). */
  account?: Address;
  /** Optional override; defaults to the connected chain. */
  chainId?: number;
}

/**
 * Return type of {@link useAccountLiquidationPrice}.
 */
export interface UseAccountLiquidationPriceReturnType {
  /** Liquidation price in 18-decimal-wei collateral units. `0n` when unavailable. */
  liquidationPrice: bigint;
  /** `true` while the underlying balance / positions queries are loading. */
  isLoading: boolean;
}

const EMPTY: UseAccountLiquidationPriceReturnType = { liquidationPrice: 0n, isLoading: false };

/**
 * Compute the on-chain liquidation price for an account by reading its balance
 * info and its open positions from the SYMMIO core and feeding them into
 * {@link calculateLiquidationPrice}.
 *
 * Works for both a sub-account (Majors) and a virtual account (lowcap) — the
 * formula is the same per-account; the only difference is the address you pass.
 *
 * Net position direction is taken from the first active position. lowcap VAs are
 * single-direction by design; for a mixed-direction account the result reflects
 * the first position's side only.
 *
 * @example
 * ```tsx
 * const { liquidationPrice, isLoading } = useAccountLiquidationPrice({ account: quote.partyA });
 * ```
 */
export function useAccountLiquidationPrice(
  parameters: UseAccountLiquidationPriceParameters = {},
): UseAccountLiquidationPriceReturnType {
  const { account, chainId, config } = parameters;

  const balanceQuery = useAccountBalanceInfo({ account, chainId, config });
  const positionsQuery = usePartyAOpenPositions({ partyA: account, chainId, config });

  return useMemo(() => {
    if (!account) return EMPTY;
    const balance = balanceQuery.data;
    const positions = positionsQuery.data;
    if (!balance || !positions || positions.length === 0) {
      return { liquidationPrice: 0n, isLoading: balanceQuery.isLoading || positionsQuery.isLoading };
    }

    const firstPosition = positions[0];
    if (!firstPosition) return { liquidationPrice: 0n, isLoading: false };

    const accountPositions: AccountPosition[] = positions.map((quote) => ({
      quantity: quote.quantity,
      closedAmount: quote.closedAmount,
      openedPrice: quote.openedPrice,
    }));

    const liquidationPrice = calculateLiquidationPrice({
      positions: accountPositions,
      positionType: firstPosition.positionType ?? PositionType.LONG,
      allocatedBalance: balance.allocatedBalance,
      lockedCVA: balance.lockedCVA,
      lockedLF: balance.lockedLF,
    });

    return { liquidationPrice, isLoading: false };
  }, [account, balanceQuery.data, balanceQuery.isLoading, positionsQuery.data, positionsQuery.isLoading]);
}
