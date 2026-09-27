import type { SolverId } from "../../../core/chains";
import { OrderType } from "../../../symmio-contracts/symmio/types";
import type { SolverOrderType } from "./types";

/**
 * Resolve the contract order type before signing a close operation.
 *
 * @param solverId - Solver selected for this close request.
 * @param orderType - Requested market or limit order.
 * @returns Best-effort market for Enigma market closes; otherwise the requested type.
 * @internal
 */
export function resolveCloseOrderType(solverId: SolverId, orderType: SolverOrderType): OrderType {
  return solverId === "enigma" && orderType === OrderType.MARKET ? OrderType.MARKET_BEST_EFFORT : orderType;
}
