import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteSolverParameter } from "../../../shared/types/properties";
import {
  instantCloseBulk,
  type InstantCloseBulkOrder,
  type InstantCloseBulkReturnType,
} from "../instant-close-bulk/instant-close-bulk";
import { prepareInstantCloseParams } from "../prepare-instant-close-params/prepare-instant-close-params";
import { type InstantCloseMarketData, type PositionType } from "../shared/types";

/**
 * One UI-shape close intent inside an {@link instantCloseBulkAuto} batch. Each
 * entry mirrors `prepareInstantCloseParams` minus the per-call `from`/`chainId`
 * — those are hoisted to the batch parameters because the whole batch shares
 * one signer and chain.
 */
export interface InstantCloseBulkAutoOrder {
  /** PartyA — the VA that owns the position. */
  partyA: Address;
  /** Market identification + optional pre-fetched precision metadata. */
  market: InstantCloseMarketData;
  /** Side of the position being closed. */
  positionType: PositionType;
  /** Quote id of the position. */
  quoteId: bigint;
  /** Quantity to close as decimal string (base-token units). */
  quantityToClose: string;
  /** Slippage tolerance percent (e.g. `5` for 5%). */
  slippage: number;
  /** Pre-fetched mark price as decimal string. */
  markPrice?: string;
  /** Override the EIP-712 salt for this order. */
  salt?: Hex;
  /** Override the unix-seconds deadline for this order. */
  deadline?: bigint;
}

/**
 * Parameters for {@link instantCloseBulkAuto}.
 */
export type InstantCloseBulkAutoParameters = Compute<
  WriteSolverParameter & {
    orders: readonly InstantCloseBulkAutoOrder[];
  }
>;

/**
 * Resolve every order's missing wei fields via
 * `prepareInstantCloseParams` (parallel) and submit them in one
 * `instantCloseBulk` round-trip.
 *
 * Friendly default for callers that have a list of close intents and trust the
 * SDK to fetch market/price metadata. For full control, call
 * `prepareInstantCloseParams` per order + `instantCloseBulk` directly.
 *
 * @example
 * ```ts
 * await instantCloseBulkAuto(config, {
 *   from: sessionKey,
 *   orders: [
 *     { partyA: vaA, market: { id: 1 }, positionType: PositionType.LONG, quoteId: 1n, quantityToClose: "0.5", slippage: 1 },
 *     { partyA: vaB, market: { id: 2 }, positionType: PositionType.SHORT, quoteId: 2n, quantityToClose: "1.0", slippage: 1 },
 *   ],
 * });
 * ```
 */
export async function instantCloseBulkAuto(
  config: Config,
  parameters: InstantCloseBulkAutoParameters,
): Promise<InstantCloseBulkReturnType> {
  const resolved = await Promise.all(
    parameters.orders.map(async (intent): Promise<InstantCloseBulkOrder> => {
      const prepared = await prepareInstantCloseParams(config, {
        chainId: parameters.chainId,
        from: parameters.from,
        partyA: intent.partyA,
        market: intent.market,
        positionType: intent.positionType,
        quoteId: intent.quoteId,
        quantityToClose: intent.quantityToClose,
        slippage: intent.slippage,
        markPrice: intent.markPrice,
        salt: intent.salt,
        deadline: intent.deadline,
      });
      return {
        partyA: prepared.partyA,
        order: prepared.order,
        salt: prepared.salt,
        deadline: prepared.deadline,
      };
    }),
  );

  return instantCloseBulk(config, {
    chainId: parameters.chainId,
    from: parameters.from,
    orders: resolved,
  });
}
