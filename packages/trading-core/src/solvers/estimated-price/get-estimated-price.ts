import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { getEstimatedPrice as requestEstimatedPrice } from "../types/generated/enigma-solver";
import { toEstimatedPrice } from "./to-estimated-price";

/** Whether a price estimate is for **opening** or **closing** a position. */
export type EstimatedPriceEntry = "open" | "close";

/**
 * Parameters for {@link getEstimatedPrice}.
 */
export type GetEstimatedPriceParameters = Compute<
  ReadSolverParameter & {
    /** Solver market id. */
    symbolId: number;
    /** Order quantity (decimal string). */
    quantity: string;
    /** Long or short. */
    positionType: PositionType;
    /** Whether this estimate is for an open or a close. */
    entry: EstimatedPriceEntry;
    /**
     * The price **sent to the solver** — the slippage-adjusted request price the
     * caller computed for the open/close, **not** the raw mark price. The solver
     * prices the fill relative to it.
     */
    price: string;
  }
>;

/**
 * Return type of {@link getEstimatedPrice}.
 */
export interface GetEstimatedPriceReturnType {
  /** Estimated execution price (decimal string); `"0"` when the solver omits it. */
  estimatedPrice: string;
}

/** Solver wire value for a position side (`"long"` / `"short"`). */
function positionTypeToWire(positionType: PositionType): string {
  return positionType === PositionType.SHORT ? "short" : "long";
}

/**
 * Ask the solver what price an open or close would actually fill at — a
 * read-only simulation of the trade (`GET /estimated-price`; nothing is
 * submitted). Pass the order `quantity`, the side, whether it's an open or
 * close, and the slippage-adjusted request `price`; the solver returns the price
 * it would fill at, from which the UI derives price impact (see
 * {@link calculatePriceImpact}) and — for a close — an estimated PnL.
 *
 * @param config - The SDK config.
 * @param parameters - Market, quantity, side, entry (open/close), and request price.
 * @returns The estimated execution price.
 * @throws {SymmApiError} when the solver request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const { estimatedPrice } = await getEstimatedPrice(config, {
 *   symbolId: 1,
 *   quantity: "1000",
 *   positionType: PositionType.LONG,
 *   entry: "open",
 *   price: requestPrice, // slippage-adjusted, from calculateTradeParams
 * });
 * ```
 */
export async function getEstimatedPrice(
  config: Config,
  parameters: GetEstimatedPriceParameters,
): Promise<GetEstimatedPriceReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  try {
    const response = await requestEstimatedPrice(
      {
        symbol_id: parameters.symbolId,
        quantity: parameters.quantity,
        position_type: positionTypeToWire(parameters.positionType),
        entry: parameters.entry,
        price: parameters.price,
      },
      { baseURL: solver.url },
    );
    return toEstimatedPrice(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_ESTIMATED_PRICE_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_ESTIMATED_PRICE_FAILED",
      `Failed to fetch estimated price: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
