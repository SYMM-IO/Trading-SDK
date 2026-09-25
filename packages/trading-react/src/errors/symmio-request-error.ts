import type { SymmioNormalizedErrorKind } from "./types";

/**
 * Options accepted by the {@link SymmioRequestError} constructor. Carries
 * the discriminator-specific fields the UI cares about.
 */
export interface SymmioRequestErrorOptions {
  kind: SymmioNormalizedErrorKind;
  message: string;
  /** SDK error code (e.g., "FETCH_MARKETS_FAILED", "UNSUPPORTED_CHAIN"). */
  code?: string;
  /** HTTP status code. Only meaningful when `kind === "api"`. */
  status?: number;
  /**
   * Raw response body returned by the server. Only meaningful when `kind === "api"`.
   * Forwarded verbatim from `SymmApiError.responseData` so the UI can render the
   * server's structured error fields without unwrapping `cause`.
   */
  responseData?: unknown;
  /**
   * Retry delay the server asked for, in ms, from `SymmApiError.retryAfterMs`.
   * Only meaningful when `kind === "api"`. Defaults to `null`.
   */
  retryAfterMs?: number | null;
  /** Solidity revert reason. Only meaningful when `kind === "contract-revert"`. */
  reason?: string;
  /** viem's human-readable short message. Only meaningful when `kind === "rpc"`. */
  shortMessage?: string;
  /** The original underlying error, kept for debugging. */
  cause?: unknown;
}

/**
 * The single error class every SYMMIO React hook throws when a read or write
 * fails. Carries a discriminator (`kind`) the UI can switch on without
 * inspecting viem's internal error hierarchy.
 *
 * @example
 * const { error } = useUserSubAccounts({ user });
 * if (error?.kind === "user-rejected") return null;       // silent
 * if (error?.kind === "contract-revert") return <ShowReason reason={error.reason} />;
 * if (error?.kind === "api") return <ApiError status={error.status} code={error.code} />;
 * if (error) return <GenericError message={error.message} />;
 */
export class SymmioRequestError extends Error {
  override readonly name = "SymmioRequestError";
  /** Classification used by the UI to branch on this failure. */
  readonly kind: SymmioNormalizedErrorKind;
  /** SDK error code (e.g., "FETCH_MARKETS_FAILED"). */
  readonly code?: string;
  /** HTTP status code when `kind === "api"`. */
  readonly status?: number;
  /** Raw response body returned by the server when `kind === "api"`. */
  readonly responseData?: unknown;
  /**
   * How long the server asked the client to wait before retrying, in ms,
   * parsed from its `Retry-After` header. `normalizeSymmError` sets it only for
   * `kind === "api"`, and even then it is `null` when the response carried no
   * usable header. A cross-origin browser sees the header only when the server
   * exposes it, so treat `null` as "unknown" and still back off, e.g. at least
   * one second plus jitter.
   *
   * @example
   * if (error?.kind === "api" && error.status === 429) {
   *   retryIn(error.retryAfterMs ?? 1_000 + Math.random() * 500);
   * }
   */
  readonly retryAfterMs: number | null;
  /** Solidity revert reason when `kind === "contract-revert"`. */
  readonly reason?: string;
  /** viem's short message when `kind === "rpc"`. */
  readonly shortMessage?: string;

  constructor(options: SymmioRequestErrorOptions) {
    super(options.message, { cause: options.cause });
    this.kind = options.kind;
    this.code = options.code;
    this.status = options.status;
    this.responseData = options.responseData;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.reason = options.reason;
    this.shortMessage = options.shortMessage;
  }
}
