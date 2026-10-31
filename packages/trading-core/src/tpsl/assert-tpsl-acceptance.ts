import { SymmError } from "../shared/errors/symm-error";

/** Shared acknowledgment validation; acceptance does not establish completion. */
export function assertTpSlAcceptance(body: unknown, operation: "SET" | "DELETE"): void {
  const response = (body && typeof body === "object" ? body : {}) as {
    successful?: unknown;
    message?: unknown;
    error_message?: unknown;
  };
  if (response.successful === false || response.successful === "false") {
    const message = typeof response.message === "string" ? response.message : response.error_message;
    throw new SymmError(
      "api",
      `${operation}_TPSL_REJECTED`,
      typeof message === "string"
        ? message
        : operation === "SET"
          ? "Handler rejected TP/SL submission."
          : "Handler rejected TP/SL delete.",
    );
  }
  if (response.successful !== true && response.successful !== "true") {
    throw new SymmError(
      "api",
      `${operation}_TPSL_INVALID_RESPONSE`,
      operation === "SET"
        ? "Handler did not explicitly acknowledge TP/SL submission; outcome is unknown."
        : "Handler did not explicitly acknowledge TP/SL removal; outcome is unknown.",
    );
  }
}
