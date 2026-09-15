import { encodeFunctionData, type Hex } from "viem";
import { symmioAbi } from "../../../symmio-contracts/abi/v0.8.6/symmio";

/**
 * Parameters for {@link encodeRequestToClosePosition}.
 */
export interface EncodeRequestToClosePositionParameters {
  /** Quote id of the open position. */
  quoteId: bigint;
  /** Slippage-adjusted close price (wei, 1e18 fixed-point). */
  closePrice: bigint;
  /** Quantity to close (wei, 1e18 fixed-point). */
  quantityToClose: bigint;
  /** Order type contract value (1 = MARKET). */
  orderType: number;
  /** Unix-seconds deadline. */
  deadline: bigint;
}

/**
 * Encode calldata for `Symmio.requestToClosePosition(quoteId, closePrice,
 * quantityToClose, orderType, deadline)`.
 */
export function encodeRequestToClosePosition(parameters: EncodeRequestToClosePositionParameters): Hex {
  return encodeFunctionData({
    abi: symmioAbi,
    functionName: "requestToClosePosition",
    args: [
      parameters.quoteId,
      parameters.closePrice,
      parameters.quantityToClose,
      parameters.orderType,
      parameters.deadline,
    ],
  });
}
