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

import type { AxiosError } from "axios";

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

  /** Response body from the server, if any. */
  readonly responseData: unknown;

  /** Request URL that failed. */
  readonly url: string;

  /** HTTP method (e.g., "GET", "POST"). */
  readonly method: string;

  constructor(options: {
    code: string;
    message: string;
    status: number;
    statusText: string;
    responseData?: unknown;
    url: string;
    method: string;
    cause?: Error;
  }) {
    super("api", options.code, options.message, { cause: options.cause });
    this.status = options.status;
    this.statusText = options.statusText;
    this.responseData = options.responseData;
    this.url = options.url;
    this.method = options.method;
  }

  /**
   * Build a `SymmApiError` from an axios error.
   *
   * Pulls `status`, `statusText`, `url`, `method`, and `responseData` off the
   * axios error and keeps the original axios error as `cause`. The composed
   * message is `"<code>: <axios message> (<METHOD> <URL> → <status> <statusText>)"`
   * so a single log line carries the code, original message, and request
   * coordinates.
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
      message: `${options.code}: ${err.message} (${method} ${url} → ${status} ${statusText})`,
      status,
      statusText,
      responseData: err.response?.data,
      url,
      method,
      cause: err,
    });
  }
}
