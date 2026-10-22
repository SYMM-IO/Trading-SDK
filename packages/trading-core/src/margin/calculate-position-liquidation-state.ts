import type { Address } from "viem";
import { calculateLiquidationPrice, type AccountPosition } from "../quotes/liquidation/calculate-liquidation-price";
import { mulWei } from "../shared/utils/wei";
import type { AccountBalanceInfo } from "../symmio-contracts/account-layer/types";
import { PositionType } from "../symmio-contracts/symmio/types";
import { calculateMarginRisk, type MarginRiskMetrics } from "./calculate-margin-risk";

/** An open quote in a complete, single-market VA book. Amounts are core-18. */
export interface LiquidationPosition extends AccountPosition {
  /** On-chain quote identifier. */
  id: bigint;
  /** Quote's PartyA: its VA, never the owner wallet. */
  account: Address;
  /** Market identifier. */
  symbolId: bigint;
  /** Direction of this quote. */
  positionType: PositionType;
}

/** Snapshot inputs for per-position risk. No IO or implicit wall clock. */
export interface CalculatePositionLiquidationStateParameters {
  /** Position being presented. */
  positionId: bigint;
  /** Liquidation domain shared by all supplied positions. */
  account: Address;
  /** Complete open book for this VA; do not pass only the visible page. */
  positions: readonly LiquidationPosition[];
  /** False until the whole book has resolved successfully. */
  complete: boolean;
  /** Raw, unadjusted VA balance. Absent means unknown, not zero. */
  balance?: AccountBalanceInfo;
  /** Gross unpaid funding liability, counted once. Receivables are excluded. */
  unpaidFundingDebt: bigint;
  /** Authoritative liquidation flag or terminal quote event. */
  liquidated: boolean;
  /** Market feed price and observation time, not an executable close estimate. */
  mark?: { price: bigint; updatedAt: number };
  /** Current epoch milliseconds, supplied by the caller. */
  nowMs: number;
  /** Maximum acceptable mark age in milliseconds. */
  maxPriceAgeMs: number;
  /** Warning buffer as basis points of the zero-PnL cushion; default 2500 (25%). */
  warningThresholdBps?: number;
}

/** Risk derived from one liquidation domain, attached to a position identity. */
export interface PositionLiquidationState {
  /** Unknown includes incomplete inputs and empty post-close VAs. */
  status: "ready" | "unknown" | "stale" | "liquidated";
  /** Undefined means unavailable; zero means no positive liquidation price. */
  liquidationPrice?: bigint;
  /** Display cushion including pending locks and unpaid funding debt. */
  metrics?: MarginRiskMetrics;
  /** Whether the fresh mark reaches the price boundary or the warning buffer. */
  isAtRisk: boolean;
  /** Strict protocol predicate, distinct from a completed liquidation. */
  isLiquidatable: boolean;
  /** True only from authoritative state, never inferred from price. */
  isLiquidated: boolean;
}

/**
 * Calculate risk for one quote using its entire VA book. All financial math is
 * bigint; pending locks and funding are deducted exactly once. Mixed markets or
 * directions cannot be assigned one liquidation price and return unknown.
 * @param parameters - Complete account snapshot and timestamped mark.
 * @returns Risk and liquidation price, or an explicit unavailable state.
 * @example
 * const risk = calculatePositionLiquidationState({ ...snapshot, nowMs: Date.now(), maxPriceAgeMs: 30_000 });
 */
export function calculatePositionLiquidationState(
  p: CalculatePositionLiquidationStateParameters,
): PositionLiquidationState {
  const unknown: PositionLiquidationState = {
    status: "unknown",
    isAtRisk: false,
    isLiquidatable: false,
    isLiquidated: p.liquidated,
  };
  if (p.liquidated) return { ...unknown, status: "liquidated" };
  const position = p.positions.find((q) => q.id === p.positionId);
  const b = p.balance;
  if (!p.complete || !position || !b || !p.mark || p.mark.price <= 0n || p.unpaidFundingDebt < 0n) return unknown;
  if (
    !Number.isFinite(p.nowMs) ||
    !Number.isFinite(p.mark.updatedAt) ||
    p.mark.updatedAt > p.nowMs ||
    !Number.isFinite(p.maxPriceAgeMs) ||
    p.maxPriceAgeMs <= 0 ||
    p.nowMs - p.mark.updatedAt >= p.maxPriceAgeMs
  ) {
    return { ...unknown, status: "stale" };
  }
  if (
    p.positions.some(
      (q) =>
        q.account.toLowerCase() !== p.account.toLowerCase() ||
        (q.positionType !== PositionType.LONG && q.positionType !== PositionType.SHORT) ||
        q.symbolId !== position.symbolId ||
        q.positionType !== position.positionType ||
        q.openedPrice <= 0n ||
        q.quantity <= (q.closedAmount ?? 0n) ||
        (q.closedAmount ?? 0n) < 0n,
    ) ||
    new Set(p.positions.map((q) => q.id)).size !== p.positions.length
  )
    return unknown;
  if (
    b.allocatedBalance === 0n &&
    b.lockedCVA === 0n &&
    b.lockedLF === 0n &&
    b.pendingLockedCVA === 0n &&
    b.pendingLockedLF === 0n
  )
    return unknown;
  const upnl = p.positions.reduce(
    (sum, q) =>
      sum +
      mulWei(
        q.quantity - (q.closedAmount ?? 0n),
        position.positionType === PositionType.LONG ? p.mark!.price - q.openedPrice : q.openedPrice - p.mark!.price,
      ),
    0n,
  );
  const allocatedBalance = b.allocatedBalance - p.unpaidFundingDebt;
  const protocol = calculateMarginRisk({ ...b, allocatedBalance, upnl });
  const effective = { ...b, allocatedBalance: allocatedBalance - b.pendingLockedCVA - b.pendingLockedLF };
  const metrics = calculateMarginRisk({ ...effective, upnl });
  const liquidationPrice = calculateLiquidationPrice({
    ...effective,
    positions: p.positions,
    positionType: position.positionType,
  });
  const threshold = p.warningThresholdBps ?? 2500;
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 10_000) return unknown;
  const atBoundary =
    liquidationPrice > 0n &&
    (position.positionType === PositionType.LONG ? p.mark.price <= liquidationPrice : p.mark.price >= liquidationPrice);
  return {
    status: "ready",
    liquidationPrice,
    metrics,
    isAtRisk:
      atBoundary ||
      metrics.remainingToLiquidation <= 0n ||
      (metrics.liquidationBufferPercent !== undefined &&
        metrics.liquidationBufferPercent < BigInt(threshold) * 10n ** 16n),
    isLiquidatable: protocol.isLiquidatable,
    isLiquidated: false,
  };
}
