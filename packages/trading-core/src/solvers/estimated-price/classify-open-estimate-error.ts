import type { SolverErrorEnvelope } from "../shared/solver-error-envelope";

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

// Also support responses that omit error_category. Source: https://solver.enigma.bz/api/error_codes/detailed
const UNAVAILABLE_SOLVER_CODES = new Set([
  // internal
  3000,
  3112,
  // unavailable
  3201,
  3204,
  3403,
  3404,
  3406,
  3407,
  3706,
  3707,
  3713,
  3405, // timeout
  3602,
  3705, // rate_limit
]);
const UNAVAILABLE_CATEGORIES = new Set(["internal", "unavailable", "timeout", "rate_limit"]);

/** Preserve explicit solver refusals; only unavailable estimates permit fallback. */
export function classifyOpenEstimateError(
  status: number,
  envelope: SolverErrorEnvelope | undefined,
  transportCode?: string,
): "OPEN_ESTIMATE_UNAVAILABLE" | "OPEN_ESTIMATE_REJECTED" {
  if (status === 401 || status === 403) return "OPEN_ESTIMATE_REJECTED";
  if (envelope) {
    if (
      status === 404 &&
      envelope.code === 404 &&
      envelope.category === "validation" &&
      envelope.detail === "/estimated-price"
    ) {
      return "OPEN_ESTIMATE_UNAVAILABLE";
    }
    const unavailable =
      envelope.category !== undefined
        ? UNAVAILABLE_CATEGORIES.has(envelope.category)
        : envelope.code !== undefined && UNAVAILABLE_SOLVER_CODES.has(envelope.code);
    return unavailable ? "OPEN_ESTIMATE_UNAVAILABLE" : "OPEN_ESTIMATE_REJECTED";
  }
  if (status === 0) {
    // Axios also uses a response-less error for invalid URLs/options and
    // unsupported adapters. Those are not network unavailability.
    return transportCode && UNAVAILABLE_TRANSPORT_CODES.has(transportCode)
      ? "OPEN_ESTIMATE_UNAVAILABLE"
      : "OPEN_ESTIMATE_REJECTED";
  }
  return status === 408 || status === 429 || status >= 500 ? "OPEN_ESTIMATE_UNAVAILABLE" : "OPEN_ESTIMATE_REJECTED";
}
