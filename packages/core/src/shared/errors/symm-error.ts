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
}
