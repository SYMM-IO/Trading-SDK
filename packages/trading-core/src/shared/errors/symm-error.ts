import type { AxiosError } from "axios";
import { readHttpHeader } from "../utils/http-header";
import { parseRetryAfterMs } from "./retry-after";

/**
 * Broad classification of SDK errors.
 *
 * - `config` — SDK configuration issues (missing chain, no wallet client).
 * - `api` — HTTP/REST API failures (solver, price service).
 * - `validation` — Input validation failures (missing required params).
 */
export type SymmErrorKind = "config" | "api" | "validation";

/**
 * Base error class for SDK-level failures.
 *
 * Every SDK error includes:
 * - `kind` — broad category for error handling branches
 * - `code` — specific error identifier within that kind
 *
 * On-chain failures surface as viem errors and are not wrapped.
 */
export class SymmError extends Error {
  override readonly name: string = "SymmError";

  /** Broad classification (e.g., "config", "api", "validation"). */
  readonly kind: SymmErrorKind;

  /** Specific error identifier (e.g., "UNSUPPORTED_CHAIN", "MISSING_USER"). */
  readonly code: string;

  constructor(kind: SymmErrorKind, code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.kind = kind;
    this.code = code;
  }
}

/**
 * Error class for HTTP/API failures from solver or other REST endpoints.
 *
 * Captures full request/response context for debugging and error handling.
 * Always has `kind: "api"`.
 */
export class SymmApiError extends SymmError {
  /** HTTP status code (e.g., 400, 401, 500). */
  readonly status: number;

  /** HTTP status text (e.g., "Bad Request", "Unauthorized"). */
  readonly statusText: string;

  /**
   * Raw response body from the server.
   *
   * For solver/hedger endpoints this is typically the documented
   * `XfiberErrorResponse`-style payload: `{code?, error_category?,
   * error_message?, error_detail?}`. Consumers cast it to the shape they expect
   * and render whatever fields they care about.
   */
  readonly responseData: unknown;

  /** Request URL that failed. */
  readonly url: string;

  /** HTTP method (e.g., "GET", "POST"). */
  readonly method: string;

  /**
   * How long the server asked the client to wait before retrying, in
   * milliseconds, parsed from a `Retry-After` response header (delay-seconds or
   * an HTTP-date). `null` when the response carried no usable header, or when
   * there was no response at all.
   *
   * A cross-origin browser only sees `Retry-After` when the server lists it in
   * `Access-Control-Expose-Headers`, so `null` means "unknown", not "retry
   * immediately". Back off anyway, e.g. at least one second plus jitter.
   */
  readonly retryAfterMs: number | null;

  constructor(options: {
    code: string;
    message: string;
    status: number;
    statusText: string;
    responseData?: unknown;
    url: string;
    method: string;
    /** Retry delay in ms from `Retry-After`. Defaults to `null`. */
    retryAfterMs?: number | null;
    cause?: Error;
  }) {
    super("api", options.code, options.message, { cause: options.cause });
    this.status = options.status;
    this.statusText = options.statusText;
    this.responseData = options.responseData;
    this.url = options.url;
    this.method = options.method;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }

  /**
   * Build a `SymmApiError` from an axios error.
   *
   * Pulls `status`, `statusText`, `url`, `method`, `responseData` and
   * `retryAfterMs` off the axios error and keeps the original axios error as
   * `cause`. The composed message is
   * `"<code>: <axios message> (<METHOD> <URL> → <status> <statusText>)"` so a
   * single log line carries the code, original message, and request
   * coordinates.
   *
   * The axios error keeps its request config, headers and body included, so
   * redact `cause` before forwarding it to third-party logging when the request
   * carried a credential.
   *
   * Use inside an action's `catch` after re-throwing any pre-existing
   * `SymmError`:
   *
   * @example
   * ```ts
   * try {
   *   const response = await getMarketsApi({ baseURL });
   *   return response.data;
   * } catch (err) {
   *   if (err instanceof SymmError) throw err;
   *   if (isAxiosError(err)) {
   *     throw SymmApiError.fromAxios(err, { code: "FETCH_MARKETS_FAILED", baseURL });
   *   }
   *   throw new SymmError("api", "FETCH_MARKETS_FAILED", `Failed to fetch markets: ${String(err)}`);
   * }
   * ```
   */
  static fromAxios(
    err: AxiosError,
    options: {
      /** Specific error identifier (e.g., `"FETCH_MARKETS_FAILED"`). */
      code: string;
      /** Base URL of the request; combined with `err.config.url` for the full URL. */
      baseURL: string;
    },
  ): SymmApiError {
    const status = err.response?.status ?? 0;
    const statusText = err.response?.statusText ?? "Unknown";
    const url = err.config?.url ? `${options.baseURL}${err.config.url}` : options.baseURL;
    const method = err.config?.method?.toUpperCase() ?? "GET";

    return new SymmApiError({
      code: options.code,
      message: formatApiErrorMessage({ code: options.code, message: err.message, method, url, status, statusText }),
      status,
      statusText,
      responseData: err.response?.data,
      url,
      method,
      retryAfterMs: parseRetryAfterMs(readHttpHeader(err.response?.headers, "retry-after")),
      cause: err,
    });
  }
}

/**
 * Compose the one-line message {@link SymmApiError.fromAxios} gives an HTTP
 * failure: `"<code>: <message> (<METHOD> <URL> → <status> <statusText>)"`.
 *
 * @param parts - The SDK code, the transport's own message and the request coordinates.
 * @returns The composed message.
 *
 * @internal
 */
export function formatApiErrorMessage(parts: {
  code: string;
  message: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
}): string {
  return `${parts.code}: ${parts.message} (${parts.method} ${parts.url} → ${parts.status} ${parts.statusText})`;
}
