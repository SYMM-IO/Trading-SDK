import type { SymmApiError } from "../../shared/errors/symm-error";

const UNAVAILABLE_TRANSPORT_CODES = new Set([
  "ERR_NETWORK",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
]);

/** Recognize the solver's documented error envelope, including HTTP 200 refusals. */
export function hasOpenEstimateError(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const body = data as Record<string, unknown>;
  return (
    (typeof body.code === "number" && Number.isInteger(body.code) && body.code !== 0) ||
    (typeof body.error_category === "string" && body.error_category.length > 0) ||
    (typeof body.error_message === "string" && body.error_message.length > 0) ||
    (typeof body.error_detail === "string" && body.error_detail.length > 0)
  );
}

/** Preserve explicit solver refusals; only unavailable estimates permit fallback. */
export function classifyOpenEstimateError(
  error: Pick<SymmApiError, "status" | "responseData"> & { transportCode?: string },
): "OPEN_ESTIMATE_UNAVAILABLE" | "OPEN_ESTIMATE_REJECTED" {
  const body = error.responseData;
  const category = body && typeof body === "object" && "error_category" in body ? body.error_category : undefined;
  switch (category) {
    case "internal":
    case "unavailable":
    case "timeout":
    case "rate_limit":
      return "OPEN_ESTIMATE_UNAVAILABLE";
  }
  // Unknown coded refusals remain authoritative. Do not infer a business
  // decision from its free-form message or assume every HTTP error is technical.
  if (hasOpenEstimateError(body)) return "OPEN_ESTIMATE_REJECTED";
  if (error.status === 0) {
    // Axios also uses a response-less error for invalid URLs/options and
    // unsupported adapters. Those are not network unavailability.
    return error.transportCode && UNAVAILABLE_TRANSPORT_CODES.has(error.transportCode)
      ? "OPEN_ESTIMATE_UNAVAILABLE"
      : "OPEN_ESTIMATE_REJECTED";
  }
  return error.status === 408 || error.status === 429 || error.status >= 500
    ? "OPEN_ESTIMATE_UNAVAILABLE"
    : "OPEN_ESTIMATE_REJECTED";
}
