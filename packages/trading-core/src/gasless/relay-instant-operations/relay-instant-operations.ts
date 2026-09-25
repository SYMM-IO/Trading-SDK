import type { Address, Hex } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { formatGaslessOperation } from "../format-gasless-operation";
import { generateGaslessIdempotencyKey, postGaslessSubmit, resolveGaslessHttp } from "../http";
import { toGaslessSubmitReceipt } from "../to-gasless-submit-receipt";
import type { GaslessSubmitReceipt } from "../types";
import { assertGaslessWalletId, toGaslessWalletIdWire } from "../wallet-id";
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
  /**
   * Which of the owner's GaslessWallets this operation executes from. Defaults
   * to `0n`, which is what every ordinary InstantLayer operation and every
   * delegation grant uses.
   *
   * Only a **gasless-wallet `execute`** operation names a positive id, and the
   * id must match the wallet the operation was signed against: the signed
   * `target` is that wallet's address, so changing the id without re-signing
   * relays the signature against the wrong wallet and the batch reverts.
   */
  walletId?: bigint;
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
    /**
     * Registered result-chained template id; omit for independent batches.
     *
     * The contract's `relayInstantTemplate` takes no wallet ids, so a template
     * batch must leave every operation on wallet `0`.
     */
    templateId?: number;
    /**
     * Stable retry key (max 128 chars). Defaults to a random UUID.
     *
     * **One key per signature.** The signed operations are built by the caller
     * here, so the key is a parameter: pass the same one to replay a submit
     * whose response was lost, and the service returns the existing record
     * instead of duplicating work. Change anything in the batch — re-sign, add
     * an operation, move a wallet id — and the key must change too, or the
     * service answers `409 IDEMPOTENCY_KEY_CONFLICT`
     * (`isGaslessIdempotencyConflictError`).
     */
    idempotencyKey?: string;
    /** Non-secret client correlation data stored with the request. */
    metadata?: Record<string, unknown>;
  }
>;

/** Return type of {@link relayInstantOperations}. */
export type RelayInstantOperationsReturnType = GaslessSubmitReceipt;

/**
 * The wallet ids a batch relays under, one per operation, validated.
 *
 * Always sent explicitly, never left to the service's zero-filling default:
 * an omitted array is a legacy-client affordance, and relying on it would make
 * a dropped or reordered id indistinguishable from "no wallets selected".
 *
 * @internal
 */
function toGaslessBatchWalletIds(
  operations: readonly GaslessSignedOperationInput[],
  templateId: number | undefined,
): bigint[] {
  const walletIds = operations.map((entry, index) =>
    assertGaslessWalletId(entry.walletId ?? 0n, `operations[${index}].walletId`),
  );
  if (templateId !== undefined && walletIds.some((walletId) => walletId !== 0n)) {
    throw new SymmError(
      "validation",
      "GASLESS_TEMPLATE_WALLET_ID_UNSUPPORTED",
      `Gasless: templateId ${templateId} relays through relayInstantTemplate, which takes no wallet ids — every operation in a template batch must use wallet 0. Relay gasless-wallet operations as an ordinary batch instead.`,
    );
  }
  return walletIds;
}

/**
 * Submit signed InstantLayer operations to the GaslessQ relayer.
 *
 * Fire-and-forget: the service validates and simulates the batch, returns
 * `202` with a `request_id`, and broadcasts asynchronously — poll
 * `getGaslessRequest` (or await `waitForGaslessRequest`) to a terminal status.
 *
 * Transport failures are dispositioned before they reach you: a `429` or a
 * gateway-`503` is resent under the same key (it never reached the service),
 * an ambiguous failure is resent once and then thrown as
 * `GASLESS_SUBMIT_UNCONFIRMED` with the exact bytes to replay
 * (`getGaslessUnconfirmedSubmit` → `resubmitGaslessRequest`), and a definitive
 * 4xx is thrown as-is — inspect it with `parseGaslessErrorDetail` or
 * `classifyGaslessFailure`, and treat only `isConfirmedGaslessFeeLimitError` /
 * `isConfirmedGaslessUnavailableError` as safe grounds for a wallet-paid retry.
 *
 * **A 202 is the point of no return**: the workflow exists server-side and the
 * transaction may execute even if polling later fails — never re-submit the
 * same intent through the wallet afterwards.
 *
 * The batch always carries an explicit `walletIds` array, one decimal id per
 * operation, taken from each entry's `walletId` (default `0n`). Persist the
 * receipt's `owner`, `walletIds` and `idempotencyKey` with its `requestId`: a
 * bare request id is not enough context to reconcile a workflow after a reload.
 *
 * @param config - The SDK config.
 * @param parameters - Signed operations, workflow labels, retry key.
 * @returns The acceptance receipt; persist `requestId` immediately.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmError} `GASLESS_EMPTY_BATCH` for an empty `operations` array.
 * @throws {SymmError} `GASLESS_TEMPLATE_ID_INVALID` for a `templateId` that is not a non-negative safe integer.
 * @throws {SymmError} `GASLESS_TEMPLATE_WALLET_ID_UNSUPPORTED` when a template batch names a non-zero wallet id.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a wallet id outside the `uint256` range.
 * @throws {SymmApiError} `GASLESS_RELAY_SUBMIT_FAILED` on HTTP failure.
 * @throws {SymmApiError} `GASLESS_SUBMIT_UNCONFIRMED` when the outcome could not be
 *   established; `responseData` is the replayable submit.
 * @throws {SymmApiError} `GASLESS_INSTANCE_MISMATCH` when a `2xx` came from another
 *   protocol instance; the accepted body (its `request_id`) stays in `responseData`.
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
  if (operations.length === 0) {
    throw new SymmError(
      "validation",
      "GASLESS_EMPTY_BATCH",
      "Gasless: relayInstantOperations needs at least one signed operation — the service rejects an empty batch.",
    );
  }
  if (templateId !== undefined && (!Number.isSafeInteger(templateId) || templateId < 0)) {
    throw new SymmError(
      "validation",
      "GASLESS_TEMPLATE_ID_INVALID",
      `Gasless: templateId ${templateId} is not a non-negative safe integer. An unguarded value serializes to JSON \`null\`, which the service reads as "no template" and relays as a plain batch.`,
    );
  }
  const walletIds = toGaslessBatchWalletIds(operations, templateId);

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
    walletIds: walletIds.map(toGaslessWalletIdWire),
    fills: operations.map((entry) => [...(entry.fills ?? [])]),
    flexFillerSignatures: operations.map((entry) => [...(entry.flexFillerSignatures ?? [])]),
    ...(metadata !== undefined ? { metadata } : {}),
  };

  const raw = await postGaslessSubmit<GaslessWireOperationAccepted>(
    context,
    "/gateway/relay-instant",
    body,
    idempotencyKey,
  );

  return toGaslessSubmitReceipt(raw, {
    owner: userAddress,
    walletIds,
    idempotencyKey,
    protocolInstance: context.protocolInstance,
  });
}
