/**
 * What the hub does after a status stream closes.
 *
 * @internal
 */
export type GaslessCloseAction =
  /** Dial again after backoff; HTTP fallback covers the gap. */
  | "retry"
  /** Dial again, but give up after a few attempts that never reach `ready`. */
  | "retry-bounded"
  /** Stop dialing for this config: the cause cannot fix itself. */
  | "disable";

/**
 * Why a stream stopped, as reported to watchers.
 *
 * @internal
 */
export type GaslessCloseReason =
  | "streams-disabled"
  | "unauthorized"
  | "forbidden"
  | "unknown-instance"
  | "client-error"
  | "protocol-error"
  | "capacity"
  | "gateway-not-ready"
  | "handshake-rejected"
  | "unreachable";

/**
 * The hub's reaction to one close code.
 *
 * @internal
 */
export interface GaslessClosePolicy {
  action: GaslessCloseAction;
  reason: GaslessCloseReason;
  /** One sentence for `onError`, naming what an operator or developer must change. */
  detail: string;
}

/** Attempts without a `ready` frame before a bounded retry gives up. */
export const GASLESS_STREAM_BOUNDED_ATTEMPTS = 3;

/**
 * Map a WebSocket close code to the hub's reaction, following the gateway's
 * documented codes.
 *
 * Retryable causes are transient service states (`1011` stream failure, `1013`
 * capacity or slow consumer, `4008` handshake cap, `4013` gateway not ready) and
 * a server-initiated normal close. Bounded retries cover the ambiguous ones: a
 * browser reports a rejected handshake — a disallowed `Origin`, for instance —
 * as `1006` with no detail, so a few attempts distinguish a flaky network from a
 * misconfiguration without looping forever. The rest are permanent for this
 * config: streams disabled (`1008`), a client bug (`1009`), or credentials and
 * routing the SDK cannot fix (`4001`, `4003`, `4004`).
 *
 * @param code - The close code, or `undefined` when the implementation gave none.
 * @returns The action, a reason for watchers, and a one-sentence detail.
 *
 * @internal
 */
export function classifyGaslessCloseCode(code?: number): GaslessClosePolicy {
  switch (code) {
    case 1000:
    case 1001:
      return {
        action: "retry",
        reason: "unreachable",
        detail: "The gateway closed the stream normally; reconnecting.",
      };
    case 1002:
      return {
        action: "retry-bounded",
        reason: "protocol-error",
        detail:
          "The gateway reported a WebSocket protocol error. Status reads continue over HTTP; check any proxy between the app and the gateway if it recurs.",
      };
    case 1008:
      return {
        action: "disable",
        reason: "streams-disabled",
        detail:
          "The gateway has status WebSockets disabled for this instance. Status reads fall back to HTTP until operators enable them.",
      };
    case 1009:
      return {
        action: "disable",
        reason: "client-error",
        detail: "The gateway rejected a command as too large. This is an SDK bug; status reads fall back to HTTP.",
      };
    case 1011:
      return {
        action: "retry",
        reason: "unreachable",
        detail: "The gateway's stream failed or named a different backend; reconnecting with backoff.",
      };
    case 1013:
      return {
        action: "retry",
        reason: "capacity",
        detail:
          "The gateway is at capacity, has no listener, or dropped a slow consumer; reconnecting with backoff while HTTP covers the gap.",
      };
    case 4001:
      return {
        action: "disable",
        reason: "unauthorized",
        detail:
          "The gateway rejected the stream handshake as unauthenticated. Browser streams are anonymous, so this instance does not allow anonymous streaming.",
      };
    case 4003:
      return {
        action: "disable",
        reason: "forbidden",
        detail: "The caller may not stream this service or instance. Correct the gateway configuration.",
      };
    case 4004:
      return {
        action: "disable",
        reason: "unknown-instance",
        detail:
          "The gateway does not know this protocol instance or service. Check `gasless.protocolInstance` and the stream origin.",
      };
    case 4008:
      return {
        action: "retry",
        reason: "capacity",
        detail: "The gateway's handshake or connection cap was reached; reconnecting with backoff.",
      };
    case 4013:
      return {
        action: "retry",
        reason: "gateway-not-ready",
        detail: "The gateway is not ready yet; reconnecting with backoff.",
      };
    case 1006:
      return {
        action: "retry-bounded",
        reason: "handshake-rejected",
        detail:
          "The connection closed without a code. A browser reports a rejected handshake — a disallowed Origin, for instance — this way, so retries are bounded and status reads continue over HTTP.",
      };
    default:
      return {
        action: "retry-bounded",
        reason: "unreachable",
        detail: `The stream closed with an unexpected code (${code ?? "none"}); retries are bounded and status reads continue over HTTP.`,
      };
  }
}
