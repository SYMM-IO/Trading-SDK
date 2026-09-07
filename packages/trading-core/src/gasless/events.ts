import type { GaslessExecutionConfig } from "../core/chains/types";
import type { GaslessRequest } from "./types";

/** One event the gasless execution observer can receive. */
export type GaslessRelayObserverEvent = Parameters<NonNullable<GaslessExecutionConfig["onEvent"]>>[0];

/**
 * Notify the config's gasless observer, swallowing anything it throws.
 *
 * The observer exists so a consumer can persist a `requestId` the moment a
 * relay is accepted — there is no list-by-wallet endpoint, so an id lost to a
 * reload is unrecoverable. That makes it load-bearing but untrusted: a throwing
 * observer must never take down the write it is observing.
 *
 * @param onEvent - The observer from `gasless.execution.onEvent`, if any.
 * @param event - The event to deliver.
 *
 * @internal
 */
export function fireGaslessEvent(onEvent: GaslessExecutionConfig["onEvent"], event: GaslessRelayObserverEvent): void {
  try {
    onEvent?.(event);
  } catch {
    /** Observer failures must never break the write. */
  }
}

/**
 * Render a request record as the vendor's wire shape, for attaching to a
 * {@link SymmApiError} as `responseData`.
 *
 * A terminal failure is not a transport failure — there is no HTTP error to
 * carry it — so the record travels in the error body instead, and consumers
 * read the real cause off `responseData` rather than parsing a message.
 *
 * @param record - The terminal request record.
 * @returns The snake_case body shape the service itself would return.
 *
 * @internal
 */
export function toGaslessRecordBody(record: GaslessRequest): Record<string, unknown> {
  return {
    request_id: record.requestId,
    status: record.status,
    error_code: record.errorCode,
    error_message: record.errorMessage,
  };
}
