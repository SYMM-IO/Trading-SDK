import type { AxiosError } from "axios";
import { redactUrl } from "./redact-url";
import { formatApiErrorMessage, SymmApiError } from "./symm-error";

/**
 * Build a {@link SymmApiError} from an axios error without keeping the request
 * headers or body.
 *
 * {@link SymmApiError.fromAxios} keeps the axios error as `cause`, and that
 * error's request config holds the request headers (an `Authorization` key)
 * and the serialized body (signed payloads). This variant keeps every field
 * `fromAxios` derives (`status`, `statusText`, `method`, `responseData`,
 * `retryAfterMs`) but:
 *
 * - replaces `cause` with a sanitized `Error` carrying only the axios `name`,
 *   `message` and `code`, plus the request's `status`, `method` and `url`;
 * - strips userinfo, the query string and the fragment from `url`, from the
 *   composed message and from the cause.
 *
 * `responseData` stays the raw response body. A server that echoes request
 * input in its error body (a FastAPI `422` puts it in `detail[].input`) still
 * exposes those values there.
 *
 * @param err - The axios error.
 * @param options - The SDK error code and the request's base URL, as for `fromAxios`.
 * @returns A `SymmApiError` whose `cause` holds no request headers or body.
 *
 * @internal
 */
export function toSanitizedApiError(err: AxiosError, options: { code: string; baseURL: string }): SymmApiError {
  const error = SymmApiError.fromAxios(err, options);
  const { code, status, statusText, method } = error;
  const url = redactUrl(error.url);
  return new SymmApiError({
    code,
    message: formatApiErrorMessage({ code, message: err.message, method, url, status, statusText }),
    status,
    statusText,
    responseData: error.responseData,
    url,
    method,
    retryAfterMs: error.retryAfterMs,
    cause: toSanitizedHttpCause(err, { status, method, url }),
  });
}

/**
 * A credential-free stand-in for an axios error, used as a sanitized
 * `SymmApiError`'s `cause`. It keeps what a log line needs (the axios `name`,
 * `message` and `code`, plus the request's `status`, `method` and
 * already-redacted `url`) and drops `config`, `request` and `response`, which
 * hold the request headers and body.
 */
function toSanitizedHttpCause(err: AxiosError, request: { status: number; method: string; url: string }): Error {
  const cause = new Error(typeof err.message === "string" ? err.message : "");
  cause.name = typeof err.name === "string" && err.name !== "" ? err.name : "AxiosError";
  return Object.assign(cause, {
    ...(typeof err.code === "string" ? { code: err.code } : {}),
    status: request.status,
    method: request.method,
    url: request.url,
  });
}
