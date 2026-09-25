import type { Hex } from "viem";
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
  /**
   * Decoded argument values — a positional array, or an object keyed by
   * parameter name. The vendor sends whichever its decoder produced, so both
   * shapes reach a consumer and neither can be assumed; narrow with
   * `Array.isArray` before indexing.
   */
  arguments?: readonly unknown[] | Record<string, unknown>;
  /** Decoded arguments keyed by parameter name, when available. */
  decoded?: Record<string, unknown> | string;
}

/**
 * The batch entry an `OperationFailed(operationIndex, revertData)` revert
 * blames, as the service reported it.
 *
 * The InstantLayer wraps every inner revert of a relayed batch in this error,
 * so the generic simulation message never names the call that actually failed.
 * Decode `revertData` against the failing target's ABI with
 * {@link decodeGaslessOperationFailure} to get the real cause.
 */
export interface GaslessFailedOperation {
  /** Zero-based position of the failing operation in the submitted batch. */
  index: number;
  /** The inner revert data, to decode against the target contract's ABI. */
  revertData: Hex;
}

/**
 * One request-validation failure from a FastAPI `422` response, whose body is
 * `{ "detail": [{ "loc", "msg", "type" }] }`. The service rejected the
 * payload's shape before acting on it, so a `422` is a client bug to fix, not a
 * condition a user can resolve.
 */
export interface GaslessValidationIssue {
  /** Path to the offending input, e.g. `["path", "request_id"]` or `["body", "signedOps", 0, "target"]`. */
  loc: readonly (string | number)[];
  /** Human-readable reason. */
  msg: string;
  /** Machine-readable failure type, e.g. `"uuid_parsing"` or `"missing"`. */
  type: string;
}

/**
 * The vendor's structured error detail, normalized from whichever envelope an
 * HTTP error used: the service's `{ detail: { code, message, details } }`, the
 * gateway's own `{ error }`, or a FastAPI `422` `{ detail: [...] }`.
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
  /**
   * The gateway's own error string, from its `{ "error": "…" }` envelope.
   * The gateway answers authentication, routing and rate-limit failures itself
   * before any service sees the request, e.g.
   * `"Unknown or disabled protocol instance: …"` or `"Rate limit exceeded"`.
   * `null` for errors the service returned.
   */
  gatewayError: string | null;
  /** The request-validation issues of a FastAPI `422` response; `null` for any other error. */
  validationErrors: readonly GaslessValidationIssue[] | null;
  /**
   * The node's plain revert string (`revert_message`), when the simulation
   * produced one. Prefer it, `contractRevert` and {@link GaslessErrorDetail.failedOperation}
   * over the generic `message` when deciding what the user can fix — an
   * `"OperationalFee: Insufficient balance"` here names the payer's shortfall,
   * which the simulation message does not.
   */
  revertMessage: string | null;
  /** The service's own decoded view of the revert (`decoded_revert`), in whatever shape it sent. */
  decodedRevert: unknown;
  /** The nested JSON-RPC error (`rpc_error`) the node returned, when the failure came from the chain. */
  rpcError: Record<string, unknown> | null;
  /** The failing batch entry of an `OperationFailed` revert; `null` when the service named none. */
  failedOperation: GaslessFailedOperation | null;
}

/**
 * Every string the service offered about a revert, joined into one haystack.
 *
 * The same cause reaches the client under different keys depending on how far
 * the service got decoding it — a custom-error name, a full signature, a
 * decoded string, the node's `revert_message`, or only the generic message — so
 * a predicate that reads one of them misses the other four.
 *
 * @param detail - A parsed vendor detail, or `null`.
 * @returns The concatenated revert text, empty when there is none.
 *
 * @internal
 */
export function gaslessRevertText(detail: GaslessErrorDetail | null): string {
  if (!detail) return "";
  const revert = detail.contractRevert;
  return [
    revert?.error,
    revert?.signature,
    typeof revert?.decoded === "string" ? revert.decoded : undefined,
    detail.revertMessage,
    typeof detail.decodedRevert === "string" ? detail.decodedRevert : undefined,
    detail.message,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" | ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Normalize a FastAPI `detail` array into validation issues, keeping only
 * `loc`, `msg` and `type`. The raw `input` and `ctx` echo request content and
 * stay in `responseData`. A malformed entry keeps whatever fields it has, with
 * empty fallbacks.
 */
function toValidationIssues(detail: unknown[]): GaslessValidationIssue[] {
  return detail.flatMap((entry): GaslessValidationIssue[] => {
    if (typeof entry === "string") return [{ loc: [], msg: entry, type: "" }];
    const record = asRecord(entry);
    if (!record) return [];
    return [
      {
        loc: Array.isArray(record.loc)
          ? record.loc.filter((part): part is string | number => typeof part === "string" || typeof part === "number")
          : [],
        msg: typeof record.msg === "string" ? record.msg : "",
        type: typeof record.type === "string" ? record.type : "",
      },
    ];
  });
}

/**
 * Read a diagnostic field the vendor may place either directly on `detail` or
 * one level down in `detail.details`, under its snake_case wire name or the
 * camelCase twin a JSON re-serializer may have produced.
 *
 * The release notes the fields (`revert_message`, `decoded_revert`, nested
 * `rpc_error`) without pinning the level they sit at, and the two observed
 * envelopes disagree, so both are searched rather than guessed.
 */
function pickDiagnostic(sources: readonly (Record<string, unknown> | null)[], ...names: readonly string[]): unknown {
  for (const source of sources) {
    if (!source) continue;
    for (const name of names) {
      if (source[name] !== undefined && source[name] !== null) return source[name];
    }
  }
  return undefined;
}

/** Coerce a wire index (number, bigint or decimal string) to a safe array index. */
function toOperationIndex(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value === "bigint") return value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/** Coerce a wire revert-data field to `Hex`; anything else is not decodable. */
function toRevertData(value: unknown): Hex | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value) ? (value as Hex) : null;
}

/**
 * Locate the failing batch entry of an `OperationFailed(operationIndex,
 * revertData)` revert.
 *
 * Two shapes carry it, and which one arrives depends on how far the service
 * decoded the revert: an explicit `failed_operation` bag beside the other
 * diagnostics, or the decoded `contract_revert` itself, whose arguments are
 * positional in one deployment and keyed by parameter name in another.
 */
function toFailedOperation(
  sources: readonly (Record<string, unknown> | null)[],
  contractRevert: GaslessContractRevert | null,
): GaslessFailedOperation | null {
  const bag = asRecord(pickDiagnostic(sources, "failed_operation", "failedOperation"));
  const candidates: (Record<string, unknown> | null)[] = [bag, ...sources];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const index = toOperationIndex(candidate.index ?? candidate.operation_index ?? candidate.operationIndex);
    const revertData = toRevertData(candidate.revert_data ?? candidate.revertData);
    if (index !== null && revertData !== null) return { index, revertData };
  }

  if (contractRevert?.error !== "OperationFailed") return null;
  const args = contractRevert.arguments;
  if (Array.isArray(args)) {
    const index = toOperationIndex(args[0]);
    const revertData = toRevertData(args[1]);
    return index !== null && revertData !== null ? { index, revertData } : null;
  }
  const keyed = asRecord(args) ?? asRecord(contractRevert.decoded);
  if (!keyed) return null;
  const index = toOperationIndex(keyed.operationIndex ?? keyed.operation_index ?? keyed.index);
  const revertData = toRevertData(keyed.revertData ?? keyed.revert_data);
  return index !== null && revertData !== null ? { index, revertData } : null;
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
 * Extract the vendor's error detail from any error a gasless action throws:
 * the service's `{ code, message, details }` (including a decoded
 * `contract_revert`, when present), the gateway's own `{ error }` string, or a
 * FastAPI `422`'s validation issues.
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

  const gatewayError = typeof record.error === "string" ? record.error : null;
  const validationIssues = Array.isArray(record.detail) ? toValidationIssues(record.detail) : [];
  const validationErrors = validationIssues.length > 0 ? validationIssues : null;

  const detail = asRecord(record.detail) ?? record;
  const code = detail.code ?? detail.error_code;
  const message = detail.message ?? detail.error_message;
  const details = asRecord(detail.details);
  const rawRevert = asRecord(pickDiagnostic([detail, details], "contract_revert", "contractRevert"));

  if (code === undefined && message === undefined && !details && gatewayError === null && validationErrors === null) {
    return null;
  }

  const revertArguments = rawRevert?.arguments;
  const contractRevert: GaslessContractRevert | null =
    rawRevert && typeof rawRevert.error === "string"
      ? {
          selector: typeof rawRevert.selector === "string" ? rawRevert.selector : "0x",
          error: rawRevert.error,
          ...(typeof rawRevert.signature === "string" ? { signature: rawRevert.signature } : {}),
          ...(Array.isArray(revertArguments) || asRecord(revertArguments)
            ? { arguments: revertArguments as GaslessContractRevert["arguments"] }
            : {}),
          ...(rawRevert.decoded !== undefined
            ? { decoded: rawRevert.decoded as GaslessContractRevert["decoded"] }
            : {}),
        }
      : null;

  /** The two levels the vendor places diagnostics at, searched in that order. */
  const sources = [detail, details];
  const revertMessage = pickDiagnostic(sources, "revert_message", "revertMessage");

  return {
    code: typeof code === "string" ? code : null,
    message: typeof message === "string" ? message : null,
    details,
    contractRevert,
    gatewayError,
    validationErrors,
    revertMessage: typeof revertMessage === "string" ? revertMessage : null,
    decodedRevert: pickDiagnostic(sources, "decoded_revert", "decodedRevert"),
    rpcError: asRecord(pickDiagnostic(sources, "rpc_error", "rpcError")),
    failedOperation: toFailedOperation(sources, contractRevert),
  };
}
