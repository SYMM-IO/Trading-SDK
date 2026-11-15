import { isAxiosError, isCancel } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { assertSolverKind } from "../assert-solver-kind";
import { getEstimatedPrice as requestEstimatedPrice } from "../types/generated/enigma-solver";
import { classifyOpenEstimateError, hasOpenEstimateError } from "./classify-open-estimate-error";
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
    /** Cancels the underlying HTTP request; no timeout is imposed by default. */
    signal?: AbortSignal;
  }
>;

/**
 * Return type of {@link getEstimatedPrice}.
 */
export interface GetEstimatedPriceReturnType {
  /** Shadow-inclusive execution price (decimal string); `"0"` when the solver omits it. Use for all trading calculations. */
  estimatedPrice: string;
  /** Execution price without shadow, when supplied by the solver. Diagnostic only; never a trading-price fallback. */
  estimatedPriceWithoutShadow?: string;
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
 * Open requests distinguish technical unavailability (`OPEN_ESTIMATE_UNAVAILABLE`)
 * from solver refusals (`OPEN_ESTIMATE_REJECTED`), including HTTP 200 error
 * envelopes. No timeout is imposed; an aborted open rejects with
 * `ESTIMATED_PRICE_CANCELLED` rather than permitting price fallback.
 *
 * @throws {SymmApiError} when the solver request fails or refuses an open estimate.
 * @throws {SymmError} when the chain is unsupported or an open estimate is cancelled.
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
  assertSolverKind(solver, "enigma", "getEstimatedPrice");

  try {
    if (parameters.entry === "open" && parameters.signal?.aborted)
      throw new SymmError("api", "ESTIMATED_PRICE_CANCELLED", "Price estimate cancelled.");

    const response = await requestEstimatedPrice(
      {
        symbol_id: parameters.symbolId,
        quantity: parameters.quantity,
        position_type: positionTypeToWire(parameters.positionType),
        entry: parameters.entry,
        price: parameters.price,
      },
      { baseURL: solver.url, signal: parameters.signal },
    );

    if (parameters.entry === "open" && parameters.signal?.aborted)
      throw new SymmError("api", "ESTIMATED_PRICE_CANCELLED", "Price estimate cancelled.");

    if (parameters.entry === "open" && hasOpenEstimateError(response.data)) {
      const code = classifyOpenEstimateError({ status: response.status ?? 200, responseData: response.data });
      throw new SymmApiError({
        code,
        message:
          code === "OPEN_ESTIMATE_UNAVAILABLE"
            ? "The solver could not provide an open estimate."
            : "The solver refused the open estimate.",
        status: response.status ?? 200,
        statusText: response.statusText ?? "OK",
        responseData: response.data,
        url: `${solver.url}/estimated-price`,
        method: "GET",
      });
    }
    return toEstimatedPrice(
      parameters.entry === "open" && (!response.data || typeof response.data !== "object") ? {} : response.data,
    );
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (
      parameters.entry === "open" &&
      (isCancel(err) || (isAxiosError(err) && err.code === "ERR_CANCELED") || parameters.signal?.aborted)
    ) {
      throw new SymmError("api", "ESTIMATED_PRICE_CANCELLED", "Price estimate cancelled.", { cause: err });
    }
    if (isAxiosError(err)) {
      const code =
        parameters.entry === "open"
          ? classifyOpenEstimateError({
              status: err.response?.status ?? 0,
              responseData: err.response?.data,
              transportCode: err.code,
            })
          : "FETCH_ESTIMATED_PRICE_FAILED";
      throw SymmApiError.fromAxios(err, { code, baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_ESTIMATED_PRICE_FAILED",
      `Failed to fetch estimated price: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
