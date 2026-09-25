import { SymmApiError, SymmError } from "@symmio/trading-core";

interface ViemLikeError extends Error {
  shortMessage?: string;
  details?: string;
}

/** Turn SDK, API, viem, and unknown failures into a compact terminal-safe line. */
export function formatError(error: unknown): string {
  if (error instanceof SymmApiError) {
    const status = error.status > 0 ? `HTTP ${error.status}` : "network";
    const retry = error.retryAfterMs != null ? ` · retry after ${Math.ceil(error.retryAfterMs / 1000)}s` : "";
    return `${error.code} · ${status}${retry}`;
  }

  if (error instanceof SymmError) return `${error.code} · ${error.message}`;

  if (error instanceof Error) {
    const viemError = error as ViemLikeError;
    return viemError.shortMessage ?? viemError.details ?? error.message;
  }

  return String(error ?? "Unknown error");
}
