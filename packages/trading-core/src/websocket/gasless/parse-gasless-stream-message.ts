import { toGaslessRequestTransaction } from "../../gasless/get-gasless-request-transactions/to-gasless-request-transaction";
import { toGaslessRequest } from "../../gasless/get-gasless-request/to-gasless-request";
import type { GaslessRequest, GaslessRequestTransaction } from "../../gasless/types";
import type { GaslessWireRequestRecord, GaslessWireTransactionAttempt } from "../../gasless/wire-types";

/**
 * Which workflow a stream frame is about: a request id, or one stored
 * transaction attempt by hash. Hash selectors are compared lowercase, the form
 * the gateway echoes.
 *
 * @internal
 */
export type GaslessStreamSelector = { kind: "request"; requestId: string } | { kind: "transaction"; txHash: string };

/**
 * A parsed inbound stream frame.
 *
 * `throttle` is the gateway's own rate-limit notice, which arrives as a bare
 * `{"error":"Rate limit exceeded"}` — no `type`, no `protocol_instance`, no
 * selector. It must be recognised before the instance check, or a healthy
 * socket would be torn down every time a command is throttled.
 *
 * @internal
 */
export type GaslessStreamMessage =
  | { type: "ready"; protocolInstance: string; maxSubscriptions: number }
  | {
      type: "snapshot" | "update";
      protocolInstance: string;
      selector: GaslessStreamSelector;
      request: GaslessRequest | null;
      transactions: readonly GaslessRequestTransaction[];
    }
  | { type: "unsubscribed"; protocolInstance: string; selector: GaslessStreamSelector }
  | { type: "error"; protocolInstance: string | null; code: string; selector: GaslessStreamSelector | null }
  | { type: "throttle"; message: string }
  | { type: "transport"; kind: "heartbeat" | "pong"; protocolInstance: string | null }
  | { type: "unparseable"; detail: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readSelector(value: unknown): GaslessStreamSelector | null {
  const subscription = asRecord(value);
  if (!subscription) return null;
  const requestId = subscription.request_id;
  if (typeof requestId === "string" && requestId !== "") return { kind: "request", requestId };
  const txHash = subscription.tx_hash;
  if (typeof txHash === "string" && txHash !== "") return { kind: "transaction", txHash: txHash.toLowerCase() };
  return null;
}

/**
 * Parse one inbound stream frame into a discriminated message.
 *
 * Parsing never throws: a malformed frame becomes `unparseable`, so one bad
 * message cannot take down a socket that is otherwise delivering. The caller
 * checks `protocolInstance` itself — every frame that carries one exposes it —
 * after handling `throttle` and `error`.
 *
 * A `snapshot`/`update` carries the same models the HTTP reads return, so both
 * transports normalize through `toGaslessRequest` / `toGaslessRequestTransaction`
 * and a consumer cannot tell which one produced a record. A record the
 * normalizer rejects (an unknown status, say) yields `request: null` rather
 * than throwing, leaving the poll fallback to fetch it.
 *
 * @param data - The raw `event.data` from the socket.
 * @returns The parsed message.
 *
 * @internal
 */
export function parseGaslessStreamMessage(data: unknown): GaslessStreamMessage {
  if (typeof data !== "string") return { type: "unparseable", detail: "the frame was not text" };

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return { type: "unparseable", detail: "the frame was not valid JSON" };
  }

  const frame = asRecord(payload);
  if (!frame) return { type: "unparseable", detail: "the frame was not a JSON object" };

  /**
   * The gateway's throttle notice has no `type` at all, so it is recognised
   * before anything else reads one.
   */
  const gatewayError = frame.error;
  if (typeof gatewayError === "string" && frame.type === undefined) {
    return { type: "throttle", message: gatewayError };
  }

  const protocolInstance = typeof frame.protocol_instance === "string" ? frame.protocol_instance : null;
  const type = frame.type;

  if (type === "ready") {
    if (protocolInstance === null) return { type: "unparseable", detail: "the ready frame named no protocol instance" };
    const max = frame.max_subscriptions;
    return {
      type: "ready",
      protocolInstance,
      maxSubscriptions: typeof max === "number" && Number.isSafeInteger(max) && max > 0 ? max : 1,
    };
  }

  if (type === "error") {
    const code = typeof frame.code === "string" ? frame.code : "GASLESS_STREAM_PROTOCOL_ERROR";
    return { type: "error", protocolInstance, code, selector: readSelector(frame.subscription) };
  }

  if (type === "heartbeat" || type === "pong") {
    return { type: "transport", kind: type, protocolInstance };
  }

  if (type === "unsubscribed") {
    const selector = readSelector(frame.subscription);
    if (!selector || protocolInstance === null) {
      return { type: "unparseable", detail: "the unsubscribed frame named no subscription" };
    }
    return { type: "unsubscribed", protocolInstance, selector };
  }

  if (type === "snapshot" || type === "update") {
    const selector = readSelector(frame.subscription);
    if (!selector || protocolInstance === null) {
      return { type: "unparseable", detail: `the ${type} frame named no subscription` };
    }
    const data = asRecord(frame.data) ?? {};
    const rawRequest = asRecord(data.request);
    let request: GaslessRequest | null = null;
    if (rawRequest && Object.keys(rawRequest).length > 0) {
      try {
        request = toGaslessRequest(rawRequest as unknown as GaslessWireRequestRecord);
      } catch {
        request = null;
      }
    }
    const rawTransactions = Array.isArray(data.transactions) ? data.transactions : [];
    const transactions: GaslessRequestTransaction[] = [];
    for (const attempt of rawTransactions) {
      const record = asRecord(attempt);
      if (!record) continue;
      try {
        transactions.push(toGaslessRequestTransaction(record as unknown as GaslessWireTransactionAttempt));
      } catch {
        /** A single unparseable attempt never discards the rest of the frame. */
      }
    }
    return { type: type as "snapshot" | "update", protocolInstance, selector, request, transactions };
  }

  return { type: "unparseable", detail: `unknown frame type ${typeof type === "string" ? `"${type}"` : "(absent)"}` };
}

/** Stable map key for a selector, so listeners and pending commands agree. @internal */
export function gaslessStreamSelectorKey(selector: GaslessStreamSelector): string {
  return selector.kind === "request" ? `request:${selector.requestId}` : `transaction:${selector.txHash}`;
}

/** The JSON command that subscribes to a selector. @internal */
export function buildGaslessSubscribeCommand(selector: GaslessStreamSelector): string {
  return selector.kind === "request"
    ? JSON.stringify({ type: "subscribe", request_id: selector.requestId })
    : JSON.stringify({ type: "subscribe", tx_hash: selector.txHash });
}

/** The JSON command that releases a selector. @internal */
export function buildGaslessUnsubscribeCommand(selector: GaslessStreamSelector): string {
  return selector.kind === "request"
    ? JSON.stringify({ type: "unsubscribe", request_id: selector.requestId })
    : JSON.stringify({ type: "unsubscribe", tx_hash: selector.txHash });
}
