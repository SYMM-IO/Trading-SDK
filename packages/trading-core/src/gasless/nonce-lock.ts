import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import { isGaslessAcceptedInstanceMismatchError } from "./http";
import { isGaslessAcceptanceInvalidError } from "./to-gasless-submit-receipt";
import type { GaslessService } from "./types";
import { getGaslessUnconfirmedSubmit } from "./unconfirmed-submit";
import { waitForGaslessRequest } from "./wait-for-gasless-request/wait-for-gasless-request";

/**
 * Per-config serialization of gasless relays by **nonce stream**.
 *
 * Replay nonces are sequential and read fresh immediately before signing; two
 * concurrent relays built from the same read would sign the same nonce and one
 * would be rejected in simulation. This chains each stream's relays behind a
 * promise so the read-sign-submit critical section never overlaps. Keyed off
 * the `Config` object with a `WeakMap` so locks die with the config.
 *
 * @internal
 */
const locks = new WeakMap<Config, Map<string, Promise<unknown>>>();

/**
 * The lock/stream key of an account's **InstantLayer** operation nonces, which
 * the contract counts per `signerAccount`.
 *
 * @param chainId - The chain the operation relays on.
 * @param signerAccount - The operation's `signerAccount.addr`.
 * @returns The stream key.
 *
 * @internal
 */
export function gaslessInstantNonceStreamKey(chainId: number, signerAccount: string): string {
  return `${chainId}:instant:${signerAccount.toLowerCase()}`;
}

/**
 * The lock/stream key of a **gasless-wallet operation** nonce stream.
 *
 * The two shapes mirror the contract's own storage. Wallet `0` counts in
 * `_legacyWalletOperationNonces[signerAccount]`, one stream per signer account
 * across every owner, so its key deliberately omits the owner — keying it by
 * owner would let two owners' relays sign the same legacy nonce. Every positive
 * id counts in `walletNonces[wallet][signerAccount]`, so its key carries both
 * the id and the owner that derives the wallet.
 *
 * @param chainId - The chain the operation relays on.
 * @param walletId - The selected wallet id.
 * @param owner - The wallet's owner.
 * @param signerAccount - The operation's `signerAccount.addr`.
 * @returns The stream key.
 *
 * @internal
 */
export function gaslessWalletNonceStreamKey(
  chainId: number,
  walletId: bigint,
  owner: string,
  signerAccount: string,
): string {
  const signer = signerAccount.toLowerCase();
  return walletId === 0n
    ? `${chainId}:wallet:0:${signer}`
    : `${chainId}:wallet:${walletId}:${owner.toLowerCase()}:${signer}`;
}

/**
 * Run `task` exclusively for one nonce stream. Queued tasks run in FIFO order;
 * a failed task never blocks the next one, and the map entry is cleared once
 * the last queued task settles.
 *
 * @param config - The SDK config the locks belong to.
 * @param key - A stream key from {@link gaslessInstantNonceStreamKey} or {@link gaslessWalletNonceStreamKey}.
 * @param task - The read-sign-submit critical section.
 *
 * @internal
 */
export function withGaslessNonceLock<result>(
  config: Config,
  key: string,
  task: () => Promise<result>,
): Promise<result> {
  return withGaslessNonceLocks(config, [key], task);
}

/**
 * Run `task` exclusively for **several** nonce streams at once — a batch that
 * signs on more than one stream (an account's InstantLayer stream plus one
 * stream per GaslessWallet id). The single-stream {@link withGaslessNonceLock}
 * is the one-key case.
 *
 * The task joins every stream's queue in the same synchronous step and starts
 * once all of their earlier tasks have settled. A task therefore only ever
 * waits on tasks queued before it, so two batches that share streams — in any
 * order — can never each hold one stream while waiting for the other's.
 *
 * @param config - The SDK config the locks belong to.
 * @param keys - The stream keys the task signs on; duplicates are ignored.
 * @param task - The read-sign-submit critical section.
 *
 * @internal
 */
export function withGaslessNonceLocks<result>(
  config: Config,
  keys: readonly string[],
  task: () => Promise<result>,
): Promise<result> {
  let byKey = locks.get(config);
  if (!byKey) {
    byKey = new Map();
    locks.set(config, byKey);
  }
  const queues = byKey;
  const streams = [...new Set(keys)];

  const previous = Promise.all(streams.map((key) => queues.get(key) ?? Promise.resolve()));
  const run = previous.then(task, task);

  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  for (const key of streams) queues.set(key, settled);
  void settled.then(() => {
    for (const key of streams) {
      if (queues.get(key) === settled) queues.delete(key);
    }
  });

  return run;
}

/**
 * A signature that left this SDK on one nonce stream and has not been seen
 * consumed on-chain yet.
 *
 * @internal
 */
interface GaslessPendingNonce {
  /** The highest nonce the submitted batch signed on this stream. */
  signedNonce: bigint;
  /** The accepted request's id, or `null` when the submit's outcome is unknown. */
  requestId: string | null;
  /** Which service stores the request. */
  service: GaslessService;
  /** The chain the request was submitted on. */
  chainId: number;
  /** When the signature expires (ms since epoch) — after that it can never land. */
  expiresAtMs: number;
}

/** The pending signature per stream, per config. @internal */
const pendingNonces = new WeakMap<Config, Map<string, GaslessPendingNonce>>();

/** How long a new caller may wait for a pending signature to resolve, whatever its deadline says. */
const GASLESS_NONCE_STREAM_WAIT_MS = 120_000;
/** Cadence of the on-chain nonce re-read while waiting for an unconfirmed submit. */
const GASLESS_NONCE_STREAM_POLL_MS = 1_500;

function pendingFor(config: Config): Map<string, GaslessPendingNonce> {
  let byKey = pendingNonces.get(config);
  if (!byKey) {
    byKey = new Map();
    pendingNonces.set(config, byKey);
  }
  return byKey;
}

/** Forget a stream's pending signature. @internal */
export function clearGaslessPendingNonce(config: Config, key: string): void {
  pendingNonces.get(config)?.delete(key);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Whether a thrown submit error leaves the stream's signed nonce **possibly or
 * certainly consumed**, so the next caller must wait for it instead of signing
 * it again.
 *
 * Three shapes qualify, and the submit path narrows every ambiguity down to
 * them before they get here:
 *
 * - `GASLESS_SUBMIT_UNCONFIRMED` — the transport failed ambiguously, or a
 *   `202` carried no `request_id`. Either way the batch may be executing.
 * - `GASLESS_ACCEPTANCE_INVALID` — the parser's own guard for that second case;
 *   acceptance is certain and only the handle was lost, which makes the nonce
 *   more likely to be consumed, not less.
 * - A `2xx` from the wrong protocol instance — accepted somewhere, so the
 *   signature must be treated as spent.
 *
 * Every other failure is a rejection that consumed nothing: the gateway refused
 * the request before the service saw it, or the service answered with a verdict.
 *
 * @param err - Anything caught from a gasless submit.
 * @returns `true` when the stream must stay blocked until the nonce moves or the signature expires.
 *
 * @internal
 */
export function blocksGaslessNonceStream(err: unknown): boolean {
  return (
    getGaslessUnconfirmedSubmit(err) !== null ||
    isGaslessAcceptanceInvalidError(err) ||
    isGaslessAcceptedInstanceMismatchError(err)
  );
}

/**
 * Submit a relay while keeping the stream's pending-signature record honest.
 *
 * The lock only spans the submit, so the nonce a released lock leaves behind is
 * still unconsumed on-chain for as long as the relayer takes to broadcast. This
 * records what was signed so the **next** caller on the stream can wait for it
 * instead of signing the same nonce again.
 *
 * A blocking failure records `requestId: null`: the batch may have been
 * accepted (an ambiguous transport failure) or is known to have been accepted
 * without a trackable id, so the stream stays blocked until the nonce is seen
 * consumed or the signature expires. A definitive rejection records nothing —
 * nothing was accepted, so the nonce is free immediately.
 *
 * @param config - The SDK config.
 * @param key - The stream key the submit was signed on.
 * @param pending - What was signed: the highest nonce, the service, the chain and the signature deadline (seconds).
 * @param submit - Performs the POST and returns the acceptance receipt.
 * @param blocksStream - Whether a thrown error leaves the signed nonce possibly or certainly consumed; pass {@link blocksGaslessNonceStream}.
 * @returns Whatever `submit` resolved with.
 *
 * @internal
 */
export function submitOnGaslessNonceStream<result extends { requestId: string }>(
  config: Config,
  key: string,
  pending: { signedNonce: bigint; service: GaslessService; chainId: number; deadline: bigint },
  submit: () => Promise<result>,
  blocksStream: (err: unknown) => boolean,
): Promise<result> {
  return submitOnGaslessNonceStreams(
    config,
    [{ key, signedNonce: pending.signedNonce }],
    pending,
    submit,
    blocksStream,
  );
}

/**
 * {@link submitOnGaslessNonceStream} for a submit that signed on **several**
 * streams — one relay request carrying an InstantLayer operation and a
 * GaslessWallet operation, say. Every stream records the same request, because
 * one request consumes all of them or none; each keeps its own highest signed
 * nonce.
 *
 * @param config - The SDK config.
 * @param streams - Each stream the submit signed on, with the highest nonce it signed there.
 * @param pending - The service, the chain and the signature deadline (seconds), shared by every stream.
 * @param submit - Performs the POST and returns the acceptance receipt.
 * @param blocksStream - Whether a thrown error leaves the signed nonces possibly or certainly consumed; pass {@link blocksGaslessNonceStream}.
 * @returns Whatever `submit` resolved with.
 *
 * @internal
 */
export async function submitOnGaslessNonceStreams<result extends { requestId: string }>(
  config: Config,
  streams: readonly { key: string; signedNonce: bigint }[],
  pending: { service: GaslessService; chainId: number; deadline: bigint },
  submit: () => Promise<result>,
  blocksStream: (err: unknown) => boolean,
): Promise<result> {
  const expiresAtMs = Number(pending.deadline) * 1_000;
  const record = (requestId: string | null) => {
    for (const stream of streams) {
      pendingFor(config).set(stream.key, {
        signedNonce: stream.signedNonce,
        requestId,
        service: pending.service,
        chainId: pending.chainId,
        expiresAtMs,
      });
    }
  };

  let receipt: result;
  try {
    receipt = await submit();
  } catch (err) {
    if (blocksStream(err)) record(null);
    throw err;
  }

  record(receipt.requestId);
  return receipt;
}

/**
 * Read a stream's consumed nonce, waiting first for anything this SDK already
 * signed on it and has not seen land.
 *
 * The relayer forwards signed nonces; it never reserves, replaces or repairs
 * them. So signing `consumed + 1` while an earlier signature for that same
 * nonce is still in flight guarantees that one of the two reverts. Rather than
 * hold the lock for the whole broadcast (which would stall every later write
 * behind a slow relay), the lock is released at the `202` and the wait happens
 * lazily here, only when a new caller actually needs the stream.
 *
 * Waiting ends as soon as the pending request reaches **any** terminal status —
 * a failed one frees the nonce, a successful one advances it — or as soon as
 * the nonce is observed to have moved past what was signed. The budget is
 * `min(signature deadline, 120 s)`: past the deadline the signature can never
 * land, so the nonce is free.
 *
 * @param config - The SDK config.
 * @param key - The stream key.
 * @param readConsumedNonce - Reads the stream's consumed nonce on-chain.
 * @returns The consumed nonce to sign from (sign `+ 1n`).
 * @throws {SymmError} `GASLESS_NONCE_STREAM_BUSY` when the budget runs out with a signature
 *   still unaccounted for — signing now would collide with it.
 *
 * @internal
 */
export async function readGaslessStreamNonce(
  config: Config,
  key: string,
  readConsumedNonce: () => Promise<bigint>,
): Promise<bigint> {
  const consumed = await readConsumedNonce();
  const pending = pendingFor(config).get(key);
  if (!pending) return consumed;

  const budgetEndsAt = Math.min(pending.expiresAtMs, Date.now() + GASLESS_NONCE_STREAM_WAIT_MS);
  /** Already consumed, or expired past any chance of landing: the stream is free. */
  if (pending.signedNonce <= consumed || budgetEndsAt <= Date.now()) {
    clearGaslessPendingNonce(config, key);
    return consumed;
  }

  if (pending.requestId !== null) {
    try {
      await waitForGaslessRequest(config, {
        chainId: pending.chainId,
        requestId: pending.requestId,
        service: pending.service,
        until: "terminal",
        timeoutMs: budgetEndsAt - Date.now(),
      });
      clearGaslessPendingNonce(config, key);
      return await readConsumedNonce();
    } catch {
      /**
       * The wait timed out or the status read kept failing. The signature is
       * still unaccounted for, so fall through to watching the nonce itself —
       * the one fact that settles it without the service.
       */
    }
  }

  while (Date.now() < budgetEndsAt) {
    await sleep(GASLESS_NONCE_STREAM_POLL_MS);
    const latest = await readConsumedNonce();
    if (latest >= pending.signedNonce) {
      clearGaslessPendingNonce(config, key);
      return latest;
    }
  }

  throw new SymmError(
    "api",
    "GASLESS_NONCE_STREAM_BUSY",
    `Gasless: nonce ${pending.signedNonce} was signed on this stream${pending.requestId ? ` for request ${pending.requestId}` : " for a submit that returned no trackable request id"} and has not landed yet. Signing now would collide with it — wait for that request to finish, or for its deadline to pass, before retrying.`,
  );
}
