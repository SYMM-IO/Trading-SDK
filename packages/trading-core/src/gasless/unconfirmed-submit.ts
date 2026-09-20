import { parseGaslessErrorDetail } from "./errors";
import type { GaslessService } from "./types";

/**
 * SDK error code of a submit whose outcome the SDK could not establish.
 *
 * @internal
 */
export const GASLESS_SUBMIT_UNCONFIRMED_CODE = "GASLESS_SUBMIT_UNCONFIRMED";

/** Vendor code of a key already bound to a different wallet selection or workflow. */
const GASLESS_IDEMPOTENCY_CONFLICT_CODE = "IDEMPOTENCY_KEY_CONFLICT";

/**
 * The gateway paths a gasless **submit** POSTs to, with the service that stores
 * the resulting workflow and the SDK error code its failures carry.
 *
 * A submit is the only kind of gasless request that can leave a side effect
 * behind when its response is lost, so the retry, idempotency and
 * "unconfirmed" machinery is keyed off this table rather than off a free-form
 * path string.
 *
 * @internal
 */
export const GASLESS_SUBMIT_ROUTES = {
  "/gateway/relay-instant": { service: "operations", code: "GASLESS_RELAY_SUBMIT_FAILED" },
  "/deposit-settlements/new-account": { service: "deposits", code: "GASLESS_SETTLEMENT_SUBMIT_FAILED" },
  "/deposit-settlements/existing-account": { service: "deposits", code: "GASLESS_SETTLEMENT_SUBMIT_FAILED" },
} as const satisfies Record<string, { service: GaslessService; code: string }>;

/**
 * One of the three gateway paths a gasless submit POSTs to.
 *
 * Closed on purpose: a resubmit replays the recorded bytes against the same
 * route, and an open string would let an arbitrary path be POSTed with a
 * signed body.
 */
export type GaslessSubmitPath = keyof typeof GASLESS_SUBMIT_ROUTES;

/**
 * Everything needed to replay one gasless submit **byte-for-byte**, recovered
 * from a `GASLESS_SUBMIT_UNCONFIRMED` error with
 * {@link getGaslessUnconfirmedSubmit}.
 *
 * The vendor's contract is that resending the identical request under the same
 * idempotency key either lands it or returns the record it already created, so
 * a lost response is recoverable — but only if the exact JSON that was sent is
 * still available. That is what this carries: `body` is the object that was
 * serialized, not a rebuilt equivalent.
 *
 * Persist it next to the workflow you were submitting. Do **not** ship it to
 * third-party logging: `body` holds the user's signed operations, and a
 * signature the service never executed stays valid until its deadline.
 */
export interface GaslessUnconfirmedSubmit {
  /** The chain the submit was made on. */
  chainId: number;
  /** The service that stores the workflow, derived from {@link GaslessUnconfirmedSubmit.path}. */
  service: GaslessService;
  /** The gateway path the body was POSTed to. */
  path: GaslessSubmitPath;
  /** The exact JSON body that was sent, to resend unchanged. */
  body: unknown;
  /** The idempotency key the submit carried, and that a resend must reuse. */
  idempotencyKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The HTTP status an error reports, whatever error class carries it.
 *
 * Read structurally rather than through `instanceof SymmApiError`, so the
 * gasless predicates keep working on the error a framework layer re-wrapped —
 * `@symmio/trading-react`'s `SymmioRequestError` copies `status`,
 * `responseData` and `code` off the API error and is what a hook consumer
 * actually catches.
 *
 * @internal
 */
export function readGaslessErrorStatus(err: unknown): number | undefined {
  if (!isRecord(err)) return undefined;
  const status = err.status;
  return typeof status === "number" ? status : undefined;
}

/** The SDK error code an error carries, read structurally. @internal */
export function readGaslessErrorCode(err: unknown): string | undefined {
  if (!isRecord(err)) return undefined;
  return typeof err.code === "string" ? err.code : undefined;
}

/**
 * Recover the replayable submit from a `GASLESS_SUBMIT_UNCONFIRMED` error.
 *
 * That error means the SDK could not establish whether the service accepted the
 * request: the transport failed ambiguously and the same-key retry failed too,
 * or a `202` came back without a `request_id`. The relayed transaction may
 * still execute, so the only safe recovery is to **resend the same bytes under
 * the same key** with {@link resubmitGaslessRequest} — never to re-run the
 * intent through the wallet.
 *
 * @param err - Anything caught from a gasless submit, including an error a
 *   framework layer re-wrapped.
 * @returns The replayable submit, or `null` when `err` is not an unconfirmed submit.
 *
 * @example
 * ```ts
 * try {
 *   await relayInstantOperations(config, parameters);
 * } catch (err) {
 *   const submit = getGaslessUnconfirmedSubmit(err);
 *   if (!submit) throw err;
 *   await persistPendingSubmit(submit);
 *   const receipt = await resubmitGaslessRequest(config, submit);
 * }
 * ```
 */
export function getGaslessUnconfirmedSubmit(err: unknown): GaslessUnconfirmedSubmit | null {
  if (readGaslessErrorCode(err) !== GASLESS_SUBMIT_UNCONFIRMED_CODE) return null;
  const data = isRecord(err) ? err.responseData : undefined;
  if (!isRecord(data)) return null;

  const { chainId, service, path, idempotencyKey } = data;
  if (typeof chainId !== "number") return null;
  if (service !== "operations" && service !== "deposits") return null;
  if (typeof path !== "string" || !(path in GASLESS_SUBMIT_ROUTES)) return null;
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) return null;

  return { chainId, service, path: path as GaslessSubmitPath, body: data.body, idempotencyKey };
}

/**
 * Whether an error is the gateway's `409 IDEMPOTENCY_KEY_CONFLICT` — the key
 * is already bound to a **different** wallet selection or workflow.
 *
 * It is a client bug, never a transport failure: the service refused to reuse
 * the key for a payload that is not the one it first saw. Mint a fresh key for
 * the new action; re-signing with the old key cannot succeed. It is also never
 * grounds for a wallet-paid retry, because the workflow the key does belong to
 * may still be executing.
 *
 * @param err - Anything caught from a gasless submit, including an error a
 *   framework layer re-wrapped.
 * @returns `true` only for that conflict.
 *
 * @example
 * ```ts
 * if (isGaslessIdempotencyConflictError(err)) {
 *   // reconcile the workflow this key already created, then rebuild with a new key
 * }
 * ```
 */
export function isGaslessIdempotencyConflictError(err: unknown): boolean {
  if (parseGaslessErrorDetail(err)?.code !== GASLESS_IDEMPOTENCY_CONFLICT_CODE) return false;
  const status = readGaslessErrorStatus(err);
  return status === undefined || status === 409;
}
