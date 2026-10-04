import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { resolveGaslessService } from "../resolve-gasless";
import type { GaslessFeeQuote, GaslessFeeSource } from "../types";
import { assertGaslessWalletId } from "../wallet-id";
import { encodeRelayBatchCallData } from "./encode-relay-batch-call-data";
import { resolveGaslessFeeQuoteError } from "./fee-quote-errors";

/** One operation of a batch to quote, with the GaslessWallet it runs against. */
export interface GaslessFeeQuoteOperation {
  /**
   * The exact operation about to be relayed — final calldata, signer account
   * and replay header. No signature is needed: the quote never verifies one.
   */
  operation: SignedOperation;
  /**
   * The GaslessWallet id the operation is relayed with. Omit (or pass `0n`) for
   * ordinary InstantLayer operations, delegation grants, and wallet-zero
   * operations; pass the wallet's id for an operation that executes from a
   * positive-id wallet. Range `0n` through `2^256 - 1`.
   */
  walletId?: bigint;
}

/**
 * Parameters for {@link getGaslessFeeQuote}.
 */
export type GetGaslessFeeQuoteParameters = Compute<
  ChainIdParameter & {
    /**
     * The full batch, in relay order. Quote the whole batch rather than one
     * operation at a time: free-quota slots and first-use wallet creation fees
     * are allocated across the batch.
     */
    operations: readonly GaslessFeeQuoteOperation[];
  }
>;

/** Return type of {@link getGaslessFeeQuote}. */
export type GetGaslessFeeQuoteReturnType = GaslessFeeQuote;

/**
 * Quote what the GaslessLayer would charge to relay a batch — **before** asking
 * the user to sign anything.
 *
 * Encodes the batch as the `relayInstantBatch` call the relayer submits (with
 * placeholder signatures) and reads `previewFeeQuote(callData, 0)`. The quote
 * applies selector fees, payer multipliers, the daily free quota, and the
 * one-time creation fee of every undeployed GaslessWallet the batch executes
 * from — any wallet id, wallet `0` included — and prices a wallet operation by
 * its inner call selectors. Every amount is 18-decimal.
 *
 * It is a preview, not a guarantee: `exact` is always `false`, the charge and its
 * payer can change before execution, and the relayer's own simulation is
 * authoritative. The quote does not check that the payer can afford it.
 *
 * Requires a multi-wallet GaslessLayer; a deployment that predates it throws
 * `GASLESS_LAYER_INTERFACE_UNSUPPORTED`. When the quote reverts with empty data,
 * one more read (quoting empty calldata) tells such a deployment apart from a
 * batch the GaslessLayer cannot decode.
 *
 * @param config - The SDK config.
 * @param parameters - The batch to quote and an optional chain id.
 * @returns The fee quote.
 * @throws {SymmError} `GASLESS_EMPTY_BATCH` for an empty batch, or `GASLESS_WALLET_ID_INVALID`
 *   for a wallet id outside the `uint256` range — both before any RPC call.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmError} `GASLESS_FREE_QUOTA_EXHAUSTED` when a billing account's daily free
 *   quota is spent and the GaslessLayer refuses paid operations (see
 *   {@link isGaslessFreeQuotaExhaustedError}).
 * @throws {SymmError} `GASLESS_FEE_QUOTE_REVERTED` when the contract rejects the batch
 *   (e.g. a wallet operation whose target is not the wallet of its id) or cannot
 *   decode it (malformed wallet `execute` calldata, which reverts with empty data).
 * @throws {SymmError} `GASLESS_LAYER_INTERFACE_UNSUPPORTED` when the configured address
 *   has no `previewFeeQuote`.
 * @throws Viem transport errors, unchanged — and the original viem revert, unchanged,
 *   when an empty-data revert cannot be classified because the follow-up read failed.
 *
 * @example
 * ```ts
 * const quote = await getGaslessFeeQuote(config, {
 *   operations: [{ operation }, { operation: walletOperation, walletId: 2n }],
 * });
 * const fee = quote.totalFee18; // 18-decimal
 * ```
 */
export async function getGaslessFeeQuote(
  config: Config,
  parameters: GetGaslessFeeQuoteParameters,
): Promise<GetGaslessFeeQuoteReturnType> {
  const { chainId, operations } = parameters;

  if (operations.length === 0) {
    throw new SymmError("validation", "GASLESS_EMPTY_BATCH", "Gasless: a fee quote needs at least one operation.");
  }
  const walletIds = operations.map((entry, index) =>
    assertGaslessWalletId(entry.walletId ?? 0n, `operations[${index}].walletId`),
  );

  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  const callData = encodeRelayBatchCallData({ operations: operations.map((entry) => entry.operation), walletIds });

  let quote;
  try {
    quote = await client.readContract({
      address: gasless.gaslessLayerAddress,
      abi: gaslessLayerAbi,
      functionName: "previewFeeQuote",
      args: [callData, 0n],
    });
  } catch (err) {
    throw await resolveGaslessFeeQuoteError(err, { client, gaslessLayerAddress: gasless.gaslessLayerAddress });
  }

  return {
    collateralToken: quote.collateralToken,
    collateralDecimals: quote.collateralDecimals,
    blockNumber: quote.blockNumber,
    timestamp: quote.timestamp,
    exact: quote.exact,
    payments: quote.payments.map((payment) => ({
      account: payment.account,
      payer: payment.payer,
      /** The contract writes `uint8(FeeSource.X)`, so the value is always a member. */
      source: payment.source as GaslessFeeSource,
      operationalFee18: payment.operationalFee18,
      depositFee18: payment.depositFee18,
      walletCreationFee18: payment.walletCreationFee18,
      nativeTopUpFee18: payment.nativeTopUpFee18,
      nativeGasCollateral18: payment.nativeGasCollateral18,
    })),
    totalFee18: quote.totalFee18,
    totalDebit18: quote.totalDebit18,
    freeOpsApplied: quote.freeOpsApplied,
    nativeSponsored: quote.nativeSponsored,
  };
}
