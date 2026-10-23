import { SessionKeyLoadError } from "@symmio/session-key";

/**
 * The message to show for a session-key lifecycle error.
 *
 * A stored key that fails to load is the one error worth rewording: this app
 * leaves the record untouched rather than replacing a key that may still hold
 * an on-chain delegation, so the reader needs to know what each way out does.
 * Every other error keeps its own message.
 *
 * @param error - The error `useSessionKey` reports.
 * @returns A message that names the way forward.
 */
export function describeSessionKeyError(error: Error): string {
  if (!(error instanceof SessionKeyLoadError)) return error.message;
  return `The stored session key for this wallet could not be loaded${describeCause(error.cause)}, so it was left untouched. Load it again once storage recovers, or rotate to replace it — a delegation granted to the old key stays on-chain until it expires or is revoked.`;
}

/**
 * The storage failure behind a load error, in parentheses. A failed WebCrypto
 * decrypt is an `OperationError` with an empty message, so its name stands in.
 */
function describeCause(cause: unknown): string {
  if (!(cause instanceof Error)) return "";
  const text = cause.message || cause.name;
  return text ? ` (${text})` : "";
}
