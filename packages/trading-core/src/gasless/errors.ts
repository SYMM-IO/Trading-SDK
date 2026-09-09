import { SymmApiError, SymmError } from "../shared/errors/symm-error";

/**
 * A decoded on-chain custom error the service extracted from a failed
 * `eth_call` simulation and returned inside `details.contract_revert`.
 */
export interface GaslessContractRevert {
  /** 4-byte error selector. */
  selector: string;
  /** Custom-error name, e.g. `"InvalidWalletOperationTarget"`. */
  error: string;
  /** Full error signature when the node supplied it. */
  signature?: string;
  /** Decoded argument values, positionally. */
  arguments?: unknown[];
  /** Decoded arguments keyed by parameter name, when available. */
  decoded?: Record<string, unknown> | string;
}

/**
 * The vendor's structured error detail, normalized from the
 * `{ detail: { code, message, details } }` envelope its HTTP errors use.
 */
export interface GaslessErrorDetail {
  /** Vendor error code, e.g. `"SIMULATION_REVERTED"`, `"INSUFFICIENT_ALLOWANCE"`. */
  code: string | null;
  /** Human-readable vendor message. */
  message: string | null;
  /** Safe diagnostic context; `contract_revert` is surfaced separately. */
  details: Record<string, unknown> | null;
  /** Decoded on-chain revert, when the node returned custom-error data. */
  contractRevert: GaslessContractRevert | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Recover the vendor response body from an error that merely *carries* one.
 *
 * Framework layers re-wrap {@link SymmApiError} into their own error type —
 * `@symmio/trading-react`'s `normalizeSymmError` produces a `SymmioRequestError`
 * that extends `Error` while preserving `responseData`. Without this the
 * `instanceof Error` bail below would discard the gateway's decoded revert
 * exactly where a consumer needs it most: through a hook. Matched structurally
 * because `core` cannot import a framework layer's error class.
 */
function unwrapBody(err: unknown): unknown {
  if (typeof err === "object" && err !== null && "responseData" in err) {
    return (err as { responseData: unknown }).responseData;
  }
  return err;
}

/**
 * Extract the vendor's `{ code, message, details }` error detail (including a
 * decoded `contract_revert`, when present) from any error a gasless action
 * throws.
 *
 * Gasless HTTP failures are thrown as `SymmApiError` with the raw response
 * body preserved in `responseData`; this digs the vendor envelope out of it so
 * UIs can branch on the vendor code (`FEE_POLICY_WOULD_REVERT`,
 * `INSUFFICIENT_ALLOWANCE`, `SIMULATION_REVERTED`, …) without re-parsing.
 * Also understands the flat `{ error_code, error_message }` shape stored on
 * polled records.
 *
 * @param err - Anything caught from a gasless action or read from a record.
 * @returns The normalized detail, or `null` when none can be extracted.
 *
 * @example
 * ```ts
 * try {
 *   await relayInstantOperations(config, parameters);
 * } catch (err) {
 *   const detail = parseGaslessErrorDetail(err);
 *   if (detail?.contractRevert) showRevert(detail.contractRevert.error);
 * }
 * ```
 */
export function parseGaslessErrorDetail(err: unknown): GaslessErrorDetail | null {
  const body = err instanceof SymmApiError ? err.responseData : err instanceof SymmError ? null : unwrapBody(err);
  /** A plain Error is not a response body — its `message` is not vendor detail. */
  if (body instanceof Error) return null;
  const record = asRecord(body);
  if (!record) return null;

  const detail = asRecord(record.detail) ?? record;
  const code = detail.code ?? detail.error_code;
  const message = detail.message ?? detail.error_message;
  const details = asRecord(detail.details);
  const contractRevert = asRecord(details?.contract_revert);

  if (code === undefined && message === undefined && !details) return null;

  return {
    code: typeof code === "string" ? code : null,
    message: typeof message === "string" ? message : null,
    details,
    contractRevert:
      contractRevert && typeof contractRevert.error === "string"
        ? {
            selector: typeof contractRevert.selector === "string" ? contractRevert.selector : "0x",
            error: contractRevert.error,
            ...(typeof contractRevert.signature === "string" ? { signature: contractRevert.signature } : {}),
            ...(Array.isArray(contractRevert.arguments) ? { arguments: contractRevert.arguments } : {}),
            ...(contractRevert.decoded !== undefined
              ? { decoded: contractRevert.decoded as GaslessContractRevert["decoded"] }
              : {}),
          }
        : null,
  };
}
