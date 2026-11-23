/** Normalized fields used to classify an error while retaining the original response. */
export interface SolverErrorEnvelope {
  code?: number;
  category?: string;
  detail?: string;
  message?: string;
}

function parseCode(value: unknown): number | undefined {
  const code = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof code === "number" && Number.isSafeInteger(code) ? code : undefined;
}

/** Read the error fields shared by the lowcap estimate and instant-open endpoints. */
export function readSolverErrorEnvelope(
  data: unknown,
  operation: "estimate" | "submission",
): SolverErrorEnvelope | undefined {
  if (!data || typeof data !== "object") return undefined;
  const body = data as Record<string, unknown>;
  const code = parseCode(body.code);
  const errorCode = parseCode(body.error_code);
  const category = typeof body.error_category === "string" ? body.error_category : undefined;
  const detail = typeof body.error_detail === "string" ? body.error_detail : undefined;
  const message = typeof body.error_message === "string" ? body.error_message : undefined;
  // Submission has always treated the presence of a code or category as a refusal,
  // even alongside a quote ID. Estimates also allow zero as a success sentinel.
  const hasErrorMetadata =
    operation === "submission"
      ? body.code != null || body.error_code != null || body.error_category != null
      : (body.code != null && code !== 0) || (body.error_code != null && errorCode !== 0);
  const failed = body.successful === false || body.successful === "false";
  if (!(hasErrorMetadata || category || detail || body.error_message || body.error || failed)) {
    return undefined;
  }
  // Disagreeing aliases do not establish a technical failure.
  if (body.code != null && body.error_code != null && code !== 0 && errorCode !== 0 && code !== errorCode) {
    return { detail, message };
  }
  return { code: code || errorCode, category: category || undefined, detail, message };
}
