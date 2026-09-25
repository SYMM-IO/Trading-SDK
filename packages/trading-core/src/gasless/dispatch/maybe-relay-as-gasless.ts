import type { Address, Hash, Hex } from "viem";
import type { GaslessExecutionConfig, SymmioGaslessConfig } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { GaslessWriteOptions } from "../../shared/types/properties";
import { getInstantLayerEip712Domain, signSignedOperation } from "../../solvers/instant-open/shared/eip712";
import { buildSignedOperation } from "../../solvers/instant-open/shared/operations";
import { getVirtualAccount } from "../../symmio-contracts/account-layer/actions/get-virtual-account";
import { getInstantLayerNonce } from "../../symmio-contracts/instant-layer/actions/get-instant-layer-nonce";
import { assertGaslessGatewayCoherence } from "../assert-gateway-coherence";
import { findUndelegatedGaslessSelectors, getCachedGaslessAccountOwner } from "../delegation-preflight";
import { fireGaslessEvent, toGaslessRecordBody } from "../events";
import { isConfirmedGaslessFeeLimitError, isConfirmedGaslessUnavailableError } from "../fallback";
import { isGaslessFreeQuotaExhaustedError } from "../get-gasless-fee-quote/fee-quote-errors";
import { getGaslessFeeQuote } from "../get-gasless-fee-quote/get-gasless-fee-quote";
import { generateGaslessIdempotencyKey, isGaslessAcceptedInstanceMismatchError } from "../http";
import {
  blocksGaslessNonceStream,
  gaslessInstantNonceStreamKey,
  readGaslessStreamNonce,
  submitOnGaslessNonceStream,
  withGaslessNonceLock,
} from "../nonce-lock";
import { relayInstantOperations } from "../relay-instant-operations/relay-instant-operations";
import { GASLESS_RELAYABLE_WRITES } from "../relayable-writes";
import { resolveGaslessService, supportsGaslessService } from "../resolve-gasless";
import { GaslessRequestStatus, type GaslessSubmitReceipt } from "../types";
import { getGaslessUnconfirmedSubmit, isGaslessIdempotencyConflictError } from "../unconfirmed-submit";
import { waitForGaslessRequest } from "../wait-for-gasless-request/wait-for-gasless-request";
import { registerGaslessWriteRequest } from "../write-request-registry";

/** How long a relayed operation's signature stays valid. */
const GASLESS_OPERATION_DEADLINE_SECONDS = 20 * 60;

/** One inner call of a write the dispatcher may relay. @internal */
export interface GaslessDispatchCall {
  /** Contract the calldata targets (core diamond or AccountLayer). */
  target: Address;
  /** Raw function calldata. */
  callData: Hex;
}

/** Input the write seams hand to {@link maybeRelayAsGasless}. @internal */
export interface MaybeRelayAsGaslessParameters {
  chainId?: number;
  from?: Address;
  /** The write's `gasless` parameter, verbatim. */
  gasless: boolean | GaslessWriteOptions | undefined;
  /** The calls, in execution order (a multi-call `_call` batch stays atomic as a relay batch). */
  calls: readonly GaslessDispatchCall[];
  /**
   * The sub-account the operations run under. The `_call` seam knows it; the
   * margin seam passes `virtualAccount` instead and the parent is resolved
   * on-chain (or taken from `gasless.account`).
   */
  signerAccount?: Address;
  /** The virtual account of a margin write, for parent-sub-account resolution. */
  virtualAccount?: Address;
  /**
   * An account a write targets that may be either a sub-account or a virtual
   * account — the deposit seams cannot tell the two apart from their parameters.
   * A VA resolves to its parent sub-account (a VA has no balance of its own to
   * bill); anything else is used as the billing account unchanged. Unlike
   * {@link MaybeRelayAsGaslessParameters.virtualAccount} this never throws for a
   * non-VA address.
   */
  accountMaybeVirtual?: Address;
}

/**
 * What the locked read-sign-submit section hands back: the acceptance and the
 * owner it was tracked under, or `"wallet"` when a definitive pre-broadcast
 * rejection sends the write down the wallet path.
 */
type GaslessDispatchSubmit = { receipt: GaslessSubmitReceipt; owner: Address } | "wallet";

interface ResolvedGaslessDispatch {
  gasless: SymmioGaslessConfig;
  options: GaslessWriteOptions;
  execution: GaslessExecutionConfig;
  fallback: "error" | "wallet";
}

function resolveDispatch(
  config: Config,
  parameters: MaybeRelayAsGaslessParameters,
): ResolvedGaslessDispatch | "wallet" | "unconfigured-explicit" {
  const raw = parameters.gasless;
  const options: GaslessWriteOptions = typeof raw === "boolean" ? { enabled: raw } : (raw ?? {});

  const supported = supportsGaslessService(config, { chainId: parameters.chainId });
  const execution = supported ? (resolveGaslessService(config, { chainId: parameters.chainId }).execution ?? {}) : {};
  const enabled = options.enabled ?? (execution.mode === "gasless" ? true : false);

  if (!enabled) return "wallet";
  if (!supported) {
    /** Implicit (config-driven) mode degrades silently; an explicit `gasless: true` must not. */
    return typeof raw === "boolean" || raw?.enabled !== undefined ? "unconfigured-explicit" : "wallet";
  }

  return {
    gasless: resolveGaslessService(config, { chainId: parameters.chainId }),
    options,
    execution,
    fallback: options.fallback ?? execution.fallback ?? "error",
  };
}

/**
 * The transparent gasless dispatcher. Called by relayable write actions before
 * their wallet path: returns the relayer's broadcast transaction hash when the
 * write was relayed, or `null` when the caller must proceed on the normal
 * gas-paid wallet path (gasless off, unsupported selector, or a definitive
 * pre-broadcast rejection under `fallback: "wallet"`).
 *
 * The full policy lives in the docs; the load-bearing rules are:
 * - **202 is the point of no return** — after acceptance there is no wallet
 *   fallback ever, except a `rejected` terminal whose cause is a confirmed
 *   fee/quota limit (nothing was broadcast, so a wallet retry cannot
 *   double-execute).
 * - A user's signature rejection always propagates — the user said no.
 * - The returned hash behaves exactly like a wallet-submitted hash: the
 *   caller's receipt-wait and invalidation pipelines run unchanged.
 * - A signer that is not the sub-account's owner is checked against its
 *   InstantLayer delegations **before** the signature prompt
 *   (`execution.preflightDelegation`, default on): a session key missing a
 *   selector throws `GASLESS_SIGNER_NOT_DELEGATED` — the selector set to grant
 *   is the one `getSessionKeySelectors` builds. Under `fallback: "wallet"` that
 *   rejection returns `null` instead, exactly like an exhausted free quota; note
 *   the wallet path will then fail too for a session key, which holds no gas
 *   and is not the owner — guarding that is the caller's concern, not this
 *   dispatcher's.
 * - The fee quote runs **before** the signature prompt too
 *   (`execution.preflightFee`, default on). An exhausted daily free quota throws
 *   `GASLESS_FREE_QUOTA_EXHAUSTED` (or returns `null` under `fallback: "wallet"`);
 *   a quote the contract rejects throws `GASLESS_FEE_QUOTE_REVERTED` and a
 *   GaslessLayer without the multi-wallet interface throws
 *   `GASLESS_LAYER_INTERFACE_UNSUPPORTED`, neither with a fallback. A quote that
 *   fails for transport reasons does not block: the relayer's own simulation is
 *   authoritative.
 *
 * @internal
 */
export async function maybeRelayAsGasless(
  config: Config,
  parameters: MaybeRelayAsGaslessParameters,
): Promise<Hash | null> {
  const resolved = resolveDispatch(config, parameters);
  if (resolved === "wallet") return null;
  if (resolved === "unconfigured-explicit") {
    /** Throws the precise typed error (not-configured vs wrong contracts version). */
    resolveGaslessService(config, { chainId: parameters.chainId });
    return null;
  }
  const { gasless, options, execution, fallback } = resolved;

  /** Selector gate — any non-relayable call sends the whole write to the wallet path. */
  const writes = parameters.calls.map((call) =>
    GASLESS_RELAYABLE_WRITES.get(call.callData.slice(0, 10).toLowerCase() as Hex),
  );
  if (writes.some((write) => write === undefined)) {
    if (options.enabled === true) {
      if (fallback === "wallet") return null;
      throw new SymmError(
        "validation",
        "GASLESS_NOT_RELAYABLE",
        "Gasless: this write's calldata is not relayable through the gasless service.",
      );
    }
    return null;
  }
  const operationType = writes[0]?.operationType ?? "gaslessWrite";

  const chain = config.getChainConfig(parameters.chainId);
  const chainId = chain.chainId;

  await assertGaslessGatewayCoherence(config, chainId, gasless);

  /** Billing/authority account: explicit override → seam-provided sub-account → VA parent. */
  let signerAccount = options.account ?? parameters.signerAccount;
  if (!signerAccount && parameters.accountMaybeVirtual) {
    const detail = await getVirtualAccount(config, { chainId, account: parameters.accountMaybeVirtual });
    signerAccount = detail.isExists ? detail.parentAccount : parameters.accountMaybeVirtual;
  }
  if (!signerAccount) {
    if (!parameters.virtualAccount) {
      throw new SymmError(
        "validation",
        "GASLESS_ACCOUNT_UNRESOLVED",
        "Gasless: no sub-account to relay under — pass `gasless.account`.",
      );
    }
    const detail = await getVirtualAccount(config, { chainId, account: parameters.virtualAccount });
    if (!detail.isExists) {
      throw new SymmError(
        "validation",
        "GASLESS_ACCOUNT_UNRESOLVED",
        `Gasless: ${parameters.virtualAccount} is not a known virtual account — pass \`gasless.account\` with the paying sub-account.`,
      );
    }
    signerAccount = detail.parentAccount;
  }
  const resolvedSignerAccount = signerAccount;

  const walletClient = await config.getWalletClient({ chainId, from: parameters.from });

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
      selectors: parameters.calls.map((call) => call.callData.slice(0, 10).toLowerCase() as Hex),
    });
    if (missing.length > 0) {
      /** A definitive pre-acceptance rejection, so it honors `fallback: "wallet"` like the fee quota does. */
      if (fallback === "wallet") return null;
      throw new SymmError(
        "validation",
        "GASLESS_SIGNER_NOT_DELEGATED",
        `Gasless: signer ${walletClient.account.address} holds no active InstantLayer delegation from sub-account ${resolvedSignerAccount} for selector(s) ${missing.join(", ")}. Grant them to the session key (the selector set is built by getSessionKeySelectors) or sign this write with the sub-account's owner.`,
      );
    }
  }

  const domain = getInstantLayerEip712Domain(config, { chainId });
  const events = execution.onEvent;
  const streamKey = gaslessInstantNonceStreamKey(chainId, resolvedSignerAccount);

  /**
   * The lock spans read-sign-submit only. Holding it across the broadcast wait
   * would stall every later write behind one slow relay; instead the signed
   * nonce is recorded on the stream and the next caller waits for it lazily.
   */
  const submitted = await withGaslessNonceLock(config, streamKey, async (): Promise<GaslessDispatchSubmit> => {
    /** Fresh sequential nonces, read inside the lock, immediately before signing. */
    const currentNonce = await readGaslessStreamNonce(config, streamKey, () =>
      getInstantLayerNonce(config, { chainId, account: resolvedSignerAccount }),
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + GASLESS_OPERATION_DEADLINE_SECONDS);

    const operations = parameters.calls.map((call, index) =>
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
          if (fallback === "wallet") return "wallet";
          throw err;
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
     * One key per signature: the operations above were just signed, so the key
     * is minted here rather than taken from the caller. A caller-supplied key
     * could only ever be reused for a different payload, which the service
     * answers with `409 IDEMPOTENCY_KEY_CONFLICT`.
     */
    const idempotencyKey = generateGaslessIdempotencyKey();

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
        },
        () =>
          relayInstantOperations(config, {
            chainId,
            userAddress: owner,
            operationType,
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
      if (canFallBack && fallback === "wallet") return "wallet";
      throw err;
    }
  });

  if (submitted === "wallet") return null;
  const { receipt, owner } = submitted;

  fireGaslessEvent(events, {
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

  const record = await waitForGaslessRequest(config, {
    chainId,
    requestId: receipt.requestId,
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
      requestId: receipt.requestId,
      service: "operations",
      chainId,
      protocolInstance: gasless.protocolInstance ?? null,
      broadcastHash: record.txHash,
    });
    return record.txHash;
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
  if (fallback === "wallet" && isConfirmedGaslessFeeLimitError(terminalError)) return null;
  throw terminalError;
}
