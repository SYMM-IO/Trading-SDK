import { encodeFunctionData, pad, type Hex } from "viem";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";

/**
 * Stand-in for an operation signature: 65 zero bytes, the length of a real
 * ECDSA signature. `previewFeeQuote` decodes the signatures array but never
 * verifies it, so a quote needs no signature prompt.
 */
export const GASLESS_FEE_QUOTE_PLACEHOLDER_SIGNATURE: Hex = pad("0x", { size: 65 });

/** Input of {@link encodeRelayBatchCallData}. */
export interface EncodeRelayBatchCallDataParameters {
  /** The operations, in relay order. */
  operations: readonly SignedOperation[];
  /** One wallet id per operation, aligned with `operations`. */
  walletIds: readonly bigint[];
}

/**
 * Encode the `relayInstantBatch(signedOps, signatures, fills, flexFillerSignatures, walletIds)`
 * calldata a fee quote previews — the same call the relayer submits, with
 * placeholder signatures and no flex fills, neither of which affects the price.
 *
 * @param parameters - Operations and their aligned wallet ids.
 * @returns ABI-encoded GaslessLayer calldata.
 *
 * @internal
 */
export function encodeRelayBatchCallData(parameters: EncodeRelayBatchCallDataParameters): Hex {
  const { operations, walletIds } = parameters;
  return encodeFunctionData({
    abi: gaslessLayerAbi,
    functionName: "relayInstantBatch",
    args: [
      operations,
      operations.map(() => GASLESS_FEE_QUOTE_PLACEHOLDER_SIGNATURE),
      operations.map(() => []),
      operations.map(() => []),
      walletIds,
    ],
  });
}
