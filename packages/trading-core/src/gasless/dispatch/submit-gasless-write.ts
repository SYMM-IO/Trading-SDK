import type { Address, Hex } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { getInstantLayerEip712Domain, signSignedOperation } from "../../solvers/instant-open/shared/eip712";
import { buildSignedOperation } from "../../solvers/instant-open/shared/operations";
import { getInstantLayerNonce } from "../../symmio-contracts/instant-layer/actions/get-instant-layer-nonce";
import { assertGaslessGatewayCoherence } from "../assert-gateway-coherence";
import { GASLESS_SIGNATURE_LIFETIME_SECONDS } from "../constants";
import { findUndelegatedGaslessSelectors, getCachedGaslessAccountOwner } from "../delegation-preflight";
import { fireGaslessEvent, toGaslessRecordBody } from "../events";
import { isConfirmedGaslessFeeLimitError, isConfirmedGaslessUnavailableError } from "../fallback";
import { isGaslessFreeQuotaExhaustedError } from "../get-gasless-fee-quote/fee-quote-errors";
import { getGaslessFeeQuote } from "../get-gasless-fee-quote/get-gasless-fee-quote";
import { isGaslessAcceptedInstanceMismatchError } from "../http";
import { resolveGaslessIdempotencyKey } from "../idempotency-key";
import {
  blocksGaslessNonceStream,
  gaslessInstantNonceStreamKey,
  getGaslessPendingAcceptance,
  readGaslessStreamNonce,
  submitOnGaslessNonceStream,
  withGaslessNonceLock,
} from "../nonce-lock";
import { relayInstantOperations } from "../relay-instant-operations/relay-instant-operations";
import { GaslessRequestStatus, type GaslessSubmitReceipt } from "../types";
import { getGaslessUnconfirmedSubmit, isGaslessIdempotencyConflictError } from "../unconfirmed-submit";
import { waitForGaslessRequest } from "../wait-for-gasless-request/wait-for-gasless-request";
import { registerGaslessWriteRequest } from "../write-request-registry";
import type { GaslessWriteResult, ResolvedGaslessWrite } from "./types";

type GaslessDispatchSubmit =
  | { receipt: GaslessSubmitReceipt; owner: Address }
  | Extract<GaslessWriteResult, { kind: "refused" }>;

/** Sign and submit one resolved relay attempt. Refusals carry acceptance state; this function never submits a wallet transaction. @internal */
export async function submitGaslessWrite(
  config: Config,
  write: ResolvedGaslessWrite,
  from?: Address,
): Promise<GaslessWriteResult> {
  const { chainId, gasless, options, execution, account: resolvedSignerAccount, operationType, calls } = write;

  /**
   * Fixed when the attempt starts, before any lock wait or prompt: an attempt
   * started at `T` can never execute after `T + GASLESS_SIGNATURE_LIFETIME_SECONDS`,
   * which is what lets a caller reconcile an unresolved action on a known date.
   */
  const deadline = BigInt(Math.floor(Date.now() / 1000) + GASLESS_SIGNATURE_LIFETIME_SECONDS);

  /**
   * One key per user action. A caller-owned key is reused on every attempt of
   * that action, so the service accepts the action at most once; without one,
   * the SDK generates a key that describes this attempt alone.
   */
  const callerOwnedKey = options.idempotencyKey !== undefined;
  const idempotencyKey = resolveGaslessIdempotencyKey(options.idempotencyKey);
  const streamKey = gaslessInstantNonceStreamKey(chainId, resolvedSignerAccount);

  /** This config already saw an attempt under the same key accepted: follow that request instead of signing again. */
  if (callerOwnedKey) {
    const earlier = getGaslessPendingAcceptance(config, [streamKey], idempotencyKey);
    if (earlier) return followGaslessWrite(config, write, earlier.requestId);
  }

  await assertGaslessGatewayCoherence(config, chainId, gasless);
  const walletClient = await config.getWalletClient({ chainId, from });

  /**
   * Delegation pre-flight, before any signature prompt. Without it a session key
   * that was never granted a selector still signs, the relayer still accepts,
   * and the InstantLayer reverts on-chain — the user pays a prompt for a write
   * that could never land.
   */
  if (execution.preflightDelegation ?? true) {
    const missing = await findUndelegatedGaslessSelectors(config, {
      chainId,
      signer: walletClient.account.address,
      signerAccount: resolvedSignerAccount,
      selectors: calls.map((call) => call.callData.slice(0, 10).toLowerCase() as Hex),
    });
    if (missing.length > 0) {
      return {
        kind: "refused",
        accepted: false,
        error: new SymmError(
          "validation",
          "GASLESS_SIGNER_NOT_DELEGATED",
          `Gasless: signer ${walletClient.account.address} holds no active InstantLayer delegation from sub-account ${resolvedSignerAccount} for selector(s) ${missing.join(", ")}. Grant them to the session key (the selector set is built by getSessionKeySelectors) or sign this write with the sub-account's owner.`,
        ),
      };
    }
  }

  const domain = getInstantLayerEip712Domain(config, { chainId });

  /**
   * The lock spans read-sign-submit only. Holding it across the broadcast wait
   * would stall every later write behind one slow relay; instead the signed
   * nonce is recorded on the stream and the next caller waits for it lazily.
   */
  const submitted = await withGaslessNonceLock(config, streamKey, async (): Promise<GaslessDispatchSubmit> => {
    /**
     * Fresh sequential nonces, read inside the lock, immediately before signing.
     * A retry under the same caller-owned key does not wait for its own earlier
     * submit: the service accepts the key at most once.
     */
    const currentNonce = await readGaslessStreamNonce(
      config,
      streamKey,
      () => getInstantLayerNonce(config, { chainId, account: resolvedSignerAccount }),
      callerOwnedKey ? idempotencyKey : undefined,
    );

    const operations = calls.map((call, index) =>
      buildSignedOperation({
        signer: walletClient.account.address,
        target: call.target,
        callData: call.callData,
        signerAccount: resolvedSignerAccount,
        deadline,
        nonce: currentNonce + BigInt(index + 1),
      }),
    );

    /**
     * Fee pre-flight before any signature prompt. Ordinary InstantLayer
     * operations always relay with wallet id 0.
     */
    if (execution.preflightFee ?? true) {
      try {
        await getGaslessFeeQuote(config, { chainId, operations: operations.map((operation) => ({ operation })) });
      } catch (err) {
        /** A definitive pre-acceptance rejection — nothing was signed, so a wallet retry is safe. */
        if (isGaslessFreeQuotaExhaustedError(err)) {
          return { kind: "refused", error: err, accepted: false };
        }
        /** A reverted quote or an unsupported GaslessLayer: the relay would fail the same way. */
        if (err instanceof SymmError) throw err;
        /**
         * Anything else is inconclusive: a transport or RPC failure of the quote
         * read itself, or an empty-data revert whose classifying read failed. The
         * relayer simulates the full transaction before accepting it, so signing
         * proceeds.
         */
      }
    }

    /** EIP-712 prompts — a user rejection propagates unwrapped, with no fallback. */
    const signatures: Hex[] = [];
    for (const operation of operations) {
      signatures.push(await signSignedOperation(operation, domain, walletClient));
    }

    /**
     * `userAddress` is the service's tracking identity, and the vendor asks for
     * a workflow to be persisted under its owner. The billing sub-account's
     * owner is that identity — the signer may be a session key that owns
     * nothing. An unreadable owner falls back to the signer rather than failing
     * a write over a tracking label.
     */
    const owner =
      (await getCachedGaslessAccountOwner(config, chainId, resolvedSignerAccount).catch(() => null)) ??
      walletClient.account.address;

    try {
      const receipt = await submitOnGaslessNonceStream(
        config,
        streamKey,
        {
          signedNonce: currentNonce + BigInt(operations.length),
          service: "operations",
          chainId,
          deadline,
          idempotencyKey,
          callerOwnedKey,
        },
        () =>
          relayInstantOperations(config, {
            chainId,
            operationType,
            userAddress: owner,
            accountId: resolvedSignerAccount,
            operations: operations.map((operation, index) => ({ operation, signature: signatures[index]! })),
            idempotencyKey,
          }),
        blocksGaslessNonceStream,
      );
      return { receipt, owner };
    } catch (err) {
      /**
       * The two fallback predicates already exclude everything ambiguous, but
       * the rule this guard encodes is the one that must never be re-derived
       * wrong: an unconfirmed submit, an idempotency conflict and a `2xx` from
       * the wrong instance all describe a request that may be executing right
       * now. Paying for the same intent from the wallet would double-execute
       * it, so they end the write here whatever `fallback` says.
       */
      const mayBeExecuting =
        getGaslessUnconfirmedSubmit(err) !== null ||
        isGaslessIdempotencyConflictError(err) ||
        isGaslessAcceptedInstanceMismatchError(err);
      const canFallBack =
        !mayBeExecuting && (isConfirmedGaslessFeeLimitError(err) || isConfirmedGaslessUnavailableError(err));
      if (canFallBack) return { kind: "refused", error: err, accepted: false };
      throw err;
    }
  });

  if ("kind" in submitted) return submitted;
  const { receipt, owner } = submitted;

  fireGaslessEvent(execution.onEvent, {
    type: "accepted",
    requestId: receipt.requestId,
    service: "operations",
    chainId,
    protocolInstance: gasless.protocolInstance ?? null,
    operationType,
    idempotencyKey: receipt.idempotencyKey,
    owner,
    walletIds: receipt.walletIds,
  });

  return followGaslessWrite(config, write, receipt.requestId);
}

/**
 * Follow an accepted request to its first broadcast and return that hash.
 *
 * The hash is registered so a receipt wait can follow the request rather than
 * a hash the relayer may replace. A request that ends without any broadcast
 * throws its terminal error, except a confirmed fee or quota rejection, which
 * is returned as an accepted refusal.
 */
async function followGaslessWrite(
  config: Config,
  write: ResolvedGaslessWrite,
  requestId: string,
): Promise<GaslessWriteResult> {
  const { chainId, gasless, options, execution } = write;
  const events = execution.onEvent;

  const record = await waitForGaslessRequest(config, {
    chainId,
    requestId,
    until: "broadcast",
    timeoutMs: options.broadcastTimeoutMs ?? execution.broadcastTimeoutMs,
    queuedPollMs: execution.queuedPollMs,
    submittedPollMs: execution.submittedPollMs,
    signal: options.signal,
    onUpdate: (update) => {
      if (update.txHash)
        fireGaslessEvent(events, { type: "broadcast", requestId: update.requestId, txHash: update.txHash, chainId });
    },
  });

  if (record.txHash !== null) {
    /**
     * The hash the write is about to return is only the *first* broadcast — the
     * relayer replaces it on a gas bump or a stuck nonce. Registering it here is
     * what lets the caller's receipt wait follow the request instead of a hash
     * that may never mine (`getGaslessWriteRequest`).
     */
    registerGaslessWriteRequest(config, {
      requestId: record.requestId,
      service: "operations",
      chainId,
      protocolInstance: gasless.protocolInstance ?? null,
      broadcastHash: record.txHash,
    });
    return { kind: "broadcast", hash: record.txHash };
  }

  /** Terminal without a broadcast: rejected or failed before any transaction. */
  fireGaslessEvent(events, {
    type: "terminal",
    requestId: record.requestId,
    status: record.status,
    txHash: record.txHash,
    chainId,
  });

  const terminalError = new SymmApiError({
    code: record.status === GaslessRequestStatus.REJECTED ? "GASLESS_RELAY_REJECTED" : "GASLESS_RELAY_FAILED",
    message: `Gasless: request ${record.requestId} ended ${record.status} before any broadcast${record.errorMessage ? ` — ${record.errorMessage}` : ""}.`,
    status: 200,
    statusText: "OK",
    responseData: toGaslessRecordBody(record),
    url: gasless.url,
    method: "GET",
  });

  /** A confirmed fee/quota rejection never broadcast — the one post-202 wallet fallback. */
  if (isConfirmedGaslessFeeLimitError(terminalError)) return { kind: "refused", error: terminalError, accepted: true };
  throw terminalError;
}
