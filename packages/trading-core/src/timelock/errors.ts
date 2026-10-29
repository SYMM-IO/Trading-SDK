import type { Hex } from "viem";
import { SymmApiError } from "../shared/errors/symm-error";

/** Documented approval and instant-open error codes; unknown codes remain available verbatim. */
export type TimelockErrorCode =
  | 3700
  | 3701
  | 3702
  | 3703
  | 3704
  | 3705
  | 3706
  | 3707
  | 3708
  | 3709
  | 3710
  | 3711
  | 3712
  | 3713;

/** Normalized solver failure fields. `firstMissingSelector` is diagnostic only, not a recovery decision. */
export interface TimelockErrorDetails {
  code: number | null;
  knownCode?: TimelockErrorCode;
  errorCategory: string;
  errorMessage: string;
  errorDetail?: string;
  firstMissingSelector?: Hex;
}

/** Parse a solver error body (including asynchronous `error_code` bodies), never infer success from a missing/zero code. */
export function parseTimelockErrorDetails(value: unknown): TimelockErrorDetails {
  const body = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const rawCode = body.code ?? body.error_code;
  const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? rawCode : null;
  const knownCode = code !== null && code >= 3700 && code <= 3713 ? (code as TimelockErrorCode) : undefined;
  const errorDetail = typeof body.error_detail === "string" ? body.error_detail : undefined;
  return {
    code,
    knownCode,
    errorCategory: typeof body.error_category === "string" ? body.error_category : "unknown",
    errorMessage: typeof body.error_message === "string" ? body.error_message : "The solver request failed.",
    errorDetail,
    firstMissingSelector:
      code === 3711 ? (errorDetail?.match(/\b0x[\da-fA-F]{8}\b/)?.[0] as Hex | undefined) : undefined,
  };
}

/** Typed solver rejection retaining the complete wire body and HTTP diagnostics. No retry or fallback is implied. */
export class TimelockSolverError extends SymmApiError {
  override readonly name: string = "TimelockSolverError";
  /** Typed code/category/message/detail, also preserved verbatim in `responseData`. */
  readonly details: TimelockErrorDetails;

  constructor(options: ConstructorParameters<typeof SymmApiError>[0]) {
    const details = parseTimelockErrorDetails(options.responseData);
    super({
      ...options,
      code: details.code === null ? options.code : String(details.code),
      message: details.errorMessage,
    });
    this.details = details;
  }
}
