import { SymmError } from "../../shared/errors/symm-error";

/**
 * Wrap a transport or parse failure from a notifications socket in the SDK's
 * typed error, passing an already-typed {@link SymmError} through untouched.
 * Shared by every protocol adapter so consumers see one error shape.
 */
export function toNotificationsError(event: unknown): SymmError {
  if (event instanceof SymmError) return event;
  const cause = event instanceof Error ? event : undefined;
  return new SymmError(
    "api",
    "NOTIFICATIONS_SOCKET_ERROR",
    `Notifications socket error${cause ? `: ${cause.message}` : "."}`,
    {
      cause,
    },
  );
}
