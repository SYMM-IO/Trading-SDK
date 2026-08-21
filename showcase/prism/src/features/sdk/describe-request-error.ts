"use client";

import type { Deployment } from "@/config/deployments";
import { useSolverErrorCodes } from "@symmio/trading-react";
import { useCallback } from "react";

/** What the UI should do with a failure. */
export interface DescribedError {
  /**
   * True when the user caused it deliberately — a dismissed wallet prompt.
   * Nothing should be shown; the pending toast is simply withdrawn.
   */
  isSilent: boolean;
  /** Short headline, e.g. "Order rejected". */
  title: string;
  /** One sentence a trader can act on. */
  body: string;
  /** The solver's own error code, when the failure carried one. */
  code?: string;
}

/**
 * The shape every SDK hook normalizes its failures to.
 *
 * Read structurally rather than with `instanceof`: an error can cross a module
 * boundary (or arrive from wagmi rather than the SDK) and still carry the same
 * fields, and a failed `instanceof` would silently downgrade it to "unknown".
 */
interface NormalizedError {
  kind?: string;
  code?: string;
  status?: number;
  reason?: string;
  shortMessage?: string;
  responseData?: unknown;
  message?: unknown;
}

/**
 * Turn a failed SDK call into something worth showing a trader.
 *
 * Every hook in the SDK normalizes to `SymmioRequestError`, whose `kind`
 * discriminates *why* the call failed — and the four reasons want four
 * different treatments. Rendering `error.message` flat, as this app did, gives
 * a red "Order rejected" toast to someone who simply closed their own wallet
 * prompt, and dumps viem's multi-line revert trace on someone who hit a real
 * contract error.
 *
 * The solver's numeric error codes are resolved through the solver's own
 * `/error_codes` table, so a rejection reads as the reason the solver gave
 * rather than as a number.
 *
 * @param deployment The deployment the failing call targeted, for code lookup.
 */
export function useDescribeRequestError(deployment: Deployment | undefined) {
  /* One table per solver, cached forever — the codes are static. Fetching the
     whole map once beats a request per failure, and it is available at the
     moment the error lands rather than a render later. */
  const codes = useSolverErrorCodes({
    chainId: deployment?.chainId,
    solverId: deployment?.solverId,
    query: { enabled: Boolean(deployment), staleTime: Infinity },
  });

  return useCallback(
    (error: unknown, fallbackTitle = "Request failed"): DescribedError => {
      const normalized = (error ?? {}) as NormalizedError;
      const message = typeof normalized.message === "string" ? normalized.message : String(normalized.message ?? "");

      switch (normalized.kind) {
        case "user-rejected":
          return { isSilent: true, title: "Cancelled", body: "You dismissed the signature request." };

        case "contract-revert":
          return {
            isSilent: false,
            title: "Rejected on-chain",
            body: normalized.reason ?? firstLine(message),
            code: normalized.code,
          };

        case "insufficient-funds":
          return {
            isSilent: false,
            title: "Not enough funds",
            body: "The wallet cannot cover this transaction and its gas.",
          };

        case "rpc":
          return {
            isSilent: false,
            title: "Network error",
            body: normalized.shortMessage ?? firstLine(message),
          };

        case "api": {
          const solver = readSolverError(normalized.responseData);
          const resolved = solver.code !== undefined ? codes.data?.[solver.code] : undefined;
          return {
            isSilent: false,
            title: fallbackTitle,
            body: resolved ?? solver.message ?? firstLine(message),
            code: solver.code !== undefined ? String(solver.code) : normalized.code,
          };
        }

        case "sdk":
          /* `kind` is the same for every SDK-side failure; the useful
             discriminator is the code. `UNSUPPORTED_BY_SOLVER` in particular
             means the UI offered something this deployment cannot do. */
          return {
            isSilent: false,
            title: normalized.code === "UNSUPPORTED_BY_SOLVER" ? "Not available here" : fallbackTitle,
            body:
              normalized.code === "UNSUPPORTED_BY_SOLVER"
                ? "This solver does not support that action."
                : firstLine(message),
            code: normalized.code,
          };

        default:
          return { isSilent: false, title: fallbackTitle, body: firstLine(message) };
      }
    },
    [codes.data],
  );
}

/**
 * The solver's structured rejection, if the body carries one.
 *
 * Enigma answers `{ code, error_category, error_message, error_detail }`; Rasa
 * pre-normalizes its close rejections. Neither is guaranteed, so every field is
 * probed rather than assumed.
 */
function readSolverError(responseData: unknown): { code?: number; message?: string } {
  if (!responseData || typeof responseData !== "object") return {};
  const body = responseData as Record<string, unknown>;

  const code = Number(body.code ?? body.error_code);
  const message =
    pickString(body.error_message) ??
    pickString(body.error_detail) ??
    pickString(body.detail) ??
    pickString(body.message);

  return { code: Number.isFinite(code) ? code : undefined, message };
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Errors from viem arrive as a stack; the first line is the part worth showing. */
function firstLine(message: string): string {
  const line = message.split("\n")[0]?.trim() ?? "";
  if (!line) return "The request did not go through.";
  return line.length > 180 ? `${line.slice(0, 180)}…` : line;
}
