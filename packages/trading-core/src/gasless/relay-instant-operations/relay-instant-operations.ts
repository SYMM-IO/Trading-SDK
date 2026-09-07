import type { Address, Hex } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { formatGaslessOperation } from "../format-gasless-operation";
import { toGaslessRequestStatus } from "../get-gasless-request/to-gasless-request";
import { gaslessPost, generateGaslessIdempotencyKey, isRetryableGaslessSubmitError, resolveGaslessHttp } from "../http";
import type { GaslessSubmitReceipt } from "../types";
import type { GaslessWireOperationAccepted, GaslessWireRelayInstantRequest } from "../wire-types";

/**
 * One pre-signed InstantLayer operation for a relay batch: the struct exactly
 * as it was EIP-712 signed, plus the 65-byte signature. Optional flex fills
 * and their filler signatures ride alongside when a flex-field flow uses them.
 */
export interface GaslessSignedOperationInput {
  /** The operation struct exactly as signed. */
  operation: SignedOperation;
  /** 65-byte EIP-712 signature over the operation. */
  signature: Hex;
  /** Flex fill payloads for this operation (rare; defaults to none). */
  fills?: readonly Hex[];
  /** Signatures authorizing the flex fills (parallel to `fills`). */
  flexFillerSignatures?: readonly Hex[];
}

/**
 * Parameters for {@link relayInstantOperations}.
 */
export type RelayInstantOperationsParameters = Compute<
  ChainIdParameter & {
    /**
     * The signed operations, in execution order. The batch is **atomic** — one
     * revert rolls back every operation and every fee — so only bundle
     * operations that must share fate. Replay nonces must be strictly
     * sequential in this order (`current + 1`, `current + 2`, …).
     */
    operations: readonly GaslessSignedOperationInput[];
    /**
     * Workflow label stored with the request (display, metrics, idempotency).
     * Free-form, 1–128 chars; fees are derived on-chain from calldata
     * selectors, never from this. Keep it stable per action.
     */
    operationType: string;
    /** Wallet the workflow is tracked under (not necessarily the raw signer). */
    userAddress: Address;
    /** Optional client accounting id stored with the request. */
    accountId?: string;
    /** Registered result-chained template id; omit for independent batches. */
    templateId?: number;
    /**
     * Stable retry key (max 128 chars). Defaults to a random UUID. Reuse only
     * to retry the byte-identical request — the service returns the existing
     * record instead of duplicating work.
     */
    idempotencyKey?: string;
    /** Non-secret client correlation data stored with the request. */
    metadata?: Record<string, unknown>;
  }
>;

/** Return type of {@link relayInstantOperations}. */
export type RelayInstantOperationsReturnType = GaslessSubmitReceipt;

/** Parse the 202 acceptance into {@link GaslessSubmitReceipt}. @internal */
export function toGaslessSubmitReceipt(raw: GaslessWireOperationAccepted): GaslessSubmitReceipt {
  return {
    requestId: raw.request_id,
    status: toGaslessRequestStatus(raw.status),
    paidFee: BigInt(raw.paid_fee),
    remainingFeeAllowance: BigInt(raw.remaining_fee_allowance),
  };
}

/**
 * Submit signed InstantLayer operations to the GaslessQ relayer.
 *
 * Fire-and-forget: the service validates and simulates the batch, returns
 * `202` with a `request_id`, and broadcasts asynchronously — poll
 * `getGaslessRequest` (or await `waitForGaslessRequest`) to a terminal status.
 * A network-level failure or 5xx is retried **once with the same idempotency
 * key** (safe by contract: a duplicate submit returns the existing record).
 * A definitive 4xx is thrown as-is — inspect it with
 * `parseGaslessErrorDetail`, and treat only
 * `isConfirmedGaslessFeeLimitError` / `isConfirmedGaslessUnavailableError`
 * as safe grounds for a wallet-paid retry.
 *
 * **A 202 is the point of no return**: the workflow exists server-side and the
 * transaction may execute even if polling later fails — never re-submit the
 * same intent through the wallet afterwards.
 *
 * @param config - The SDK config.
 * @param parameters - Signed operations, workflow labels, retry key.
 * @returns The acceptance receipt; persist `requestId` immediately.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmApiError} `GASLESS_RELAY_SUBMIT_FAILED` on HTTP failure.
 *
 * @example
 * ```ts
 * const receipt = await relayInstantOperations(config, {
 *   userAddress: owner,
 *   operationType: "initiateWithdraw",
 *   operations: [{ operation, signature }],
 * });
 * const record = await waitForGaslessRequest(config, { requestId: receipt.requestId });
 * ```
 */
export async function relayInstantOperations(
  config: Config,
  parameters: RelayInstantOperationsParameters,
): Promise<RelayInstantOperationsReturnType> {
  const { chainId, operations, operationType, userAddress, accountId, templateId, metadata } = parameters;
  const context = resolveGaslessHttp(config, { chainId, service: "operations" });
  const idempotencyKey = parameters.idempotencyKey ?? generateGaslessIdempotencyKey();

  const body: GaslessWireRelayInstantRequest = {
    idempotencyKey,
    userAddress,
    ...(accountId !== undefined ? { accountId } : {}),
    operationType,
    ...(templateId !== undefined ? { templateId } : {}),
    signedOps: operations.map((entry) => formatGaslessOperation(entry.operation)),
    signatures: operations.map((entry) => entry.signature),
    fills: operations.map((entry) => [...(entry.fills ?? [])]),
    flexFillerSignatures: operations.map((entry) => [...(entry.flexFillerSignatures ?? [])]),
    ...(metadata !== undefined ? { metadata } : {}),
  };

  let raw: GaslessWireOperationAccepted;
  try {
    raw = await gaslessPost<GaslessWireOperationAccepted>(
      context,
      "/gateway/relay-instant",
      body,
      "GASLESS_RELAY_SUBMIT_FAILED",
    );
  } catch (err) {
    /**
     * Ambiguous failure — the service may or may not have accepted the
     * request. One retry with the SAME key either lands it or returns the
     * already-accepted record; it can never double-execute.
     */
    if (!isRetryableGaslessSubmitError(err)) throw err;
    raw = await gaslessPost<GaslessWireOperationAccepted>(
      context,
      "/gateway/relay-instant",
      body,
      "GASLESS_RELAY_SUBMIT_FAILED",
    );
  }

  return toGaslessSubmitReceipt(raw);
}
