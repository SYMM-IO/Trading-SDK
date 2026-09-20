import axios, { isAxiosError, type AxiosResponse } from "axios";
import type { SymmioGaslessConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import { toSanitizedApiError } from "../shared/errors/sanitized-api-error";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import { readHttpHeader } from "../shared/utils/http-header";
import { parseGaslessErrorDetail } from "./errors";
import { assertGaslessUrlServes, parseGaslessUrl } from "./gasless-url";
import { resolveGaslessService } from "./resolve-gasless";
import type { GaslessService } from "./types";
import {
  GASLESS_SUBMIT_ROUTES,
  GASLESS_SUBMIT_UNCONFIRMED_CODE,
  readGaslessErrorStatus,
  type GaslessSubmitPath,
  type GaslessUnconfirmedSubmit,
} from "./unconfirmed-submit";

/** Default HTTP timeout for a gasless submit (`execution.submitTimeoutMs`). @internal */
export const GASLESS_SUBMIT_TIMEOUT_MS = 30_000;

/**
 * How many times a submit the gateway itself refused (`429`, or a `503`
 * carrying its `{ error }` envelope) is retried under the same idempotency key.
 * Both mean the request never reached the service, so a retry cannot duplicate
 * anything — the bound exists to keep a submit from outliving its caller.
 *
 * @internal
 */
export const GASLESS_SUBMIT_THROTTLE_RETRIES = 2;

/** The response header the gateway stamps with the protocol instance that answered. @internal */
export const GASLESS_PROTOCOL_INSTANCE_HEADER = "x-gaslessq-protocol-instance";

/**
 * A resolved gasless HTTP context for one `(chain, service)` pair: the final
 * per-service base URL, the request headers, and the protocol instance the
 * responses must come from.
 *
 * @internal
 */
export interface GaslessHttpContext {
  /** Final service base, e.g. `…/v1/instances/<protocol-instance>/operations`. */
  baseURL: string;
  /** Request headers: `Accept`, plus `Authorization: Bearer …` only when an `apiKey` is configured. */
  headers: Record<string, string>;
  /**
   * The protocol instance responses are asserted against, or `null` when the
   * config names none (a proxy root without `protocolInstance`).
   */
  protocolInstance: string | null;
  /**
   * Whether a response must carry the instance header. `true` for the gateway
   * URL forms, where the gateway itself stamps every routed response; `false`
   * for a proxy root, which may not forward the header, so only a header that
   * is present is checked.
   */
  requireInstanceHeader: boolean;
  /** HTTP timeout applied to submits (POSTs), in ms. */
  submitTimeoutMs: number;
  /** The chain the context was resolved for (for error messages and events). */
  chainId: number;
}

/**
 * Derive the per-service base URL from a chain's gasless config.
 *
 * The `url` forms are parsed by `parseGaslessUrl`:
 * - a gateway **origin** — the SDK appends
 *   `/v1/instances/{protocolInstance}/{service}`;
 * - an **instance root** — the SDK appends `/{service}`;
 * - an instance-pinned **service base** — used as-is, and it must match the
 *   requested service;
 * - a **proxy root** — the SDK appends `/{service}`.
 *
 * @internal
 */
export function resolveGaslessHttp(
  config: Config,
  parameters: { chainId?: number; service: GaslessService },
): GaslessHttpContext {
  const chain = config.getChainConfig(parameters.chainId);
  const gasless = resolveGaslessService(config, { chainId: parameters.chainId });
  return buildGaslessHttpContext(chain.chainId, gasless, parameters.service);
}

/**
 * Build a {@link GaslessHttpContext} from an already-resolved gasless block.
 *
 * Anonymous access is the default: the `Authorization` header is omitted
 * entirely unless a non-blank `apiKey` is configured.
 *
 * @internal
 */
export function buildGaslessHttpContext(
  chainId: number,
  gasless: SymmioGaslessConfig,
  service: GaslessService,
): GaslessHttpContext {
  const url = parseGaslessUrl(chainId, gasless);
  assertGaslessUrlServes(chainId, url, service);

  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = gasless.apiKey?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const baseURL =
    url.form === "origin"
      ? `${url.url}/v1/instances/${encodeURIComponent(url.protocolInstance)}/${service}`
      : url.form === "service-base"
        ? url.url
        : `${url.url}/${service}`;

  return {
    baseURL,
    headers,
    protocolInstance: url.protocolInstance,
    requireInstanceHeader: url.form !== "proxy-root",
    submitTimeoutMs: gasless.execution?.submitTimeoutMs ?? GASLESS_SUBMIT_TIMEOUT_MS,
    chainId,
  };
}

/**
 * Assert that a successful response came from the expected protocol instance.
 * The gateway stamps `X-GasLessQ-Protocol-Instance` on every response it
 * routes. A mismatch means a different deployment answered (a
 * staging/production cross-wire), and the response must not be trusted.
 *
 * Gateway URL forms fail closed on a missing header too. A proxy root only
 * fails on a header that is present and wrong, since a proxy may not forward
 * it.
 *
 * @internal
 * @throws {SymmError} `GASLESS_INSTANCE_MISMATCH`
 */
export function assertGaslessInstance(context: GaslessHttpContext, response: AxiosResponse): void {
  const actual = readGaslessInstanceMismatch(context, response);
  if (actual === null) return;
  throw new SymmError("api", "GASLESS_INSTANCE_MISMATCH", gaslessInstanceMismatchMessage(context, actual));
}

/**
 * The instance a response was stamped with when it is **not** the expected one,
 * or `null` when the response is trustworthy. `"<missing>"` stands for a
 * gateway response that carried no header at all.
 */
function readGaslessInstanceMismatch(context: GaslessHttpContext, response: AxiosResponse): string | null {
  const expected = context.protocolInstance;
  if (!expected) return null;
  const actual = readHttpHeader(response.headers, GASLESS_PROTOCOL_INSTANCE_HEADER);
  if (actual === undefined && !context.requireInstanceHeader) return null;
  return actual === expected ? null : (actual ?? "<missing>");
}

function gaslessInstanceMismatchMessage(context: GaslessHttpContext, actual: string): string {
  return `Gasless: the response came from protocol instance "${actual}", but chain ${context.chainId} expects "${context.protocolInstance}". Check the gasless url / protocolInstance pairing.`;
}

/**
 * Whether an error is a `GASLESS_INSTANCE_MISMATCH` on a response the gateway
 * **accepted** (a `2xx`) — the submit created a workflow somewhere, on a
 * deployment this config does not address.
 *
 * Nothing about it can be trusted except that it happened, so it is never
 * grounds for a wallet-paid retry, and any signature it consumed must be
 * treated as spent.
 *
 * @internal
 */
export function isGaslessAcceptedInstanceMismatchError(err: unknown): boolean {
  if (!(err instanceof SymmApiError) || err.code !== "GASLESS_INSTANCE_MISMATCH") return false;
  return err.status >= 200 && err.status < 300;
}

/**
 * Perform a gasless GET and normalize failures into the house error shape.
 *
 * @param context - The resolved HTTP context for the call's service.
 * @param path - The path under the service base.
 * @param code - The SDK error code a failure is reported under.
 * @param options - `signal` cancels the request in flight — pass TanStack's
 *   query signal, or the caller's own, so a poll nobody is waiting for stops
 *   spending the deployment's shared request budget.
 *
 * @internal
 */
export async function gaslessGet<data>(
  context: GaslessHttpContext,
  path: string,
  code: string,
  options: { signal?: AbortSignal } = {},
): Promise<data> {
  try {
    const response = await axios.get<data>(path, {
      baseURL: context.baseURL,
      headers: context.headers,
      signal: options.signal,
    });
    assertGaslessInstance(context, response);
    return response.data;
  } catch (err) {
    throw toGaslessError(err, context, code);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * How long to wait before resending a submit the gateway refused.
 *
 * `Retry-After` is honored when the gateway sent one and the browser was
 * allowed to read it, but never trusted as a floor of zero: a cross-origin page
 * usually sees `null`, and hammering a throttled gateway is what earned the
 * `429`. So the wait is at least a jittered second, and the jitter keeps a
 * page's concurrent workflows from retrying in lockstep.
 *
 * @param retryAfterMs - The server's requested delay, or `null` when unknown.
 * @param random - Injectable `Math.random`, for deterministic tests.
 * @returns The delay in ms.
 *
 * @internal
 */
export function gaslessSubmitRetryDelay(retryAfterMs: number | null, random: () => number = Math.random): number {
  return Math.max(retryAfterMs ?? 0, 1_000 + Math.floor(random() * 1_000));
}

/** One POST attempt: the axios call plus the house error normalization. */
async function postGaslessOnce<data>(
  context: GaslessHttpContext,
  path: string,
  body: unknown,
  code: string,
): Promise<AxiosResponse<data>> {
  try {
    return await axios.post<data>(path, body, {
      baseURL: context.baseURL,
      headers: { ...context.headers, "Content-Type": "application/json" },
      timeout: context.submitTimeoutMs,
    });
  } catch (err) {
    throw toGaslessError(err, context, code);
  }
}

/**
 * POST one gasless **submit** — the only gasless call that can leave a side
 * effect behind when its response is lost — and decide, for every outcome,
 * whether the service can have accepted it.
 *
 * Three dispositions, all under the caller's single idempotency key (the vendor
 * returns the existing record for a byte-identical resend, so reusing the key
 * can never double-execute; a *changed* payload needs a fresh one):
 *
 * - **Refused by the gateway** (`429`, or a `503` carrying its `{ error }`
 *   envelope): the request never reached the service. Resent up to
 *   {@link GASLESS_SUBMIT_THROTTLE_RETRIES} times after
 *   {@link gaslessSubmitRetryDelay}, while the wait still fits inside
 *   `execution.submitTimeoutMs`. Exhausted, the gateway's own error is thrown —
 *   the one submit failure that is provably *not* accepted, and so the only one
 *   a wallet-paid retry may follow.
 * - **Ambiguous** (no response, a timeout, or a `5xx` without the gateway
 *   envelope): the service may or may not have accepted it. Resent **once**,
 *   then thrown as `GASLESS_SUBMIT_UNCONFIRMED` carrying the exact bytes that
 *   were sent, so the caller can persist them and replay them later with
 *   `resubmitGaslessRequest`. Never a rejection, and never grounds for a wallet
 *   retry.
 * - **Answered** (any other status, or a `2xx`): thrown as-is, or returned. A
 *   `2xx` without a `request_id` is unconfirmed too — the workflow exists and
 *   nothing identifies it. A `2xx` from the wrong protocol instance throws
 *   `GASLESS_INSTANCE_MISMATCH` with the parsed body kept in `responseData`,
 *   because the `request_id` in it is the only handle on a request that was
 *   accepted somewhere.
 *
 * @param context - The resolved HTTP context for the submit's service.
 * @param path - The submit route (see {@link GASLESS_SUBMIT_ROUTES}).
 * @param body - The exact JSON body to send.
 * @param idempotencyKey - The key inside `body`, recorded on an unconfirmed submit.
 * @returns The acceptance body.
 *
 * @internal
 */
export async function postGaslessSubmit<data extends { request_id?: string | null }>(
  context: GaslessHttpContext,
  path: GaslessSubmitPath,
  body: unknown,
  idempotencyKey: string,
): Promise<data> {
  const { service, code } = GASLESS_SUBMIT_ROUTES[path];
  const retriesEndAt = Date.now() + context.submitTimeoutMs;
  let throttleRetries = 0;
  let ambiguousRetries = 0;

  for (;;) {
    let response: AxiosResponse<data>;
    try {
      response = await postGaslessOnce<data>(context, path, body, code);
    } catch (err) {
      const failure = classifyGaslessHttpStatus(err);

      if (failure === "rate-limited" || failure === "gateway-not-ready") {
        const delay = gaslessSubmitRetryDelay(err instanceof SymmApiError ? err.retryAfterMs : null);
        if (throttleRetries < GASLESS_SUBMIT_THROTTLE_RETRIES && Date.now() + delay <= retriesEndAt) {
          throttleRetries += 1;
          await sleep(delay);
          continue;
        }
        throw err;
      }

      if (failure !== "ambiguous") throw err;

      /**
       * The vendor's prescribed recovery for a lost response: resend the
       * identical request under the same key, which either lands it or returns
       * the record it already created.
       */
      if (ambiguousRetries < 1) {
        ambiguousRetries += 1;
        continue;
      }
      throw unconfirmedGaslessSubmitError(context, { service, path, body, idempotencyKey }, err);
    }

    const mismatch = readGaslessInstanceMismatch(context, response);
    if (mismatch !== null) {
      throw new SymmApiError({
        code: "GASLESS_INSTANCE_MISMATCH",
        message: `${gaslessInstanceMismatchMessage(context, mismatch)} The submit was accepted there, so reconcile the request id in responseData before submitting anything else.`,
        status: response.status,
        statusText: response.statusText,
        responseData: response.data,
        url: `${context.baseURL}${path}`,
        method: "POST",
      });
    }

    const requestId = response.data?.request_id;
    if (typeof requestId !== "string" || requestId.length === 0) {
      throw unconfirmedGaslessSubmitError(context, { service, path, body, idempotencyKey });
    }
    return response.data;
  }
}

/**
 * Build the `GASLESS_SUBMIT_UNCONFIRMED` error, whose `responseData` is the
 * replayable {@link GaslessUnconfirmedSubmit} rather than a response body —
 * there is no trustworthy response body, and the bytes that were sent are the
 * only thing that can recover the workflow.
 */
function unconfirmedGaslessSubmitError(
  context: GaslessHttpContext,
  submit: Omit<GaslessUnconfirmedSubmit, "chainId">,
  cause?: unknown,
): SymmApiError {
  const status = readGaslessErrorStatus(cause) ?? 0;
  return new SymmApiError({
    code: GASLESS_SUBMIT_UNCONFIRMED_CODE,
    message: `Gasless: the submit to ${submit.path} on chain ${context.chainId} could not be confirmed${status === 0 ? " (no response)" : ` (last status ${status})`}, so the service may already be executing it. Resend the recorded body under idempotency key ${submit.idempotencyKey} with resubmitGaslessRequest — never re-run this intent through the wallet.`,
    status,
    statusText: cause instanceof SymmApiError ? cause.statusText : "",
    responseData: { chainId: context.chainId, ...submit } satisfies GaslessUnconfirmedSubmit,
    url: `${context.baseURL}${submit.path}`,
    method: "POST",
    cause: cause instanceof Error ? cause : undefined,
  });
}

/**
 * The canonical 3-branch error normalization every gasless HTTP call shares.
 *
 * An axios failure becomes a `SymmApiError` whose `cause` is a sanitized
 * snapshot (see `toSanitizedApiError`), never the axios error itself. That
 * error's request config holds the `Authorization` header and the signed body,
 * so the `apiKey` cannot leak through a logged or serialized error.
 * `responseData` stays the raw response body.
 *
 * @internal
 */
export function toGaslessError(err: unknown, context: GaslessHttpContext, code: string): Error {
  if (err instanceof SymmError) return err;
  if (isAxiosError(err)) return toSanitizedApiError(err, { code, baseURL: context.baseURL });
  return new SymmError("api", code, `Gasless request failed: ${err instanceof Error ? err.message : String(err)}`, {
    cause: err instanceof Error ? err : undefined,
  });
}

/**
 * How a failed gasless HTTP call was disposed of, from the status and, where
 * the gateway overloads a status, from the body: the gateway's own
 * `{ "error": "…" }` envelope versus a service `{ "detail": … }` body.
 *
 * - `"rate-limited"` — `429`: dropped at the gateway, never forwarded.
 * - `"gateway-not-ready"` — `503` with the gateway envelope: its configuration is not ready.
 * - `"unauthorized"` / `"forbidden"` — `401` / `403`: credentials rejected, or not allowed for this instance or service.
 * - `"unknown-instance"` — `404` with the gateway envelope: no such instance or service route.
 * - `"selector-conflict"` — `400` with the gateway envelope: the URL and the instance selector disagree.
 * - `"client-schema"` — `422`: the service rejected the payload shape (a client bug).
 * - `"ambiguous"` — no response (network failure or timeout), `408`, or any other `5xx`: the request may or may not have reached the service.
 * - `"service"` — any other status: the service answered with its own verdict (`detail.code`).
 *
 * @internal
 */
export type GaslessHttpFailureClass =
  | "rate-limited"
  | "gateway-not-ready"
  | "unauthorized"
  | "forbidden"
  | "unknown-instance"
  | "selector-conflict"
  | "client-schema"
  | "ambiguous"
  | "service";

/**
 * Classify a failed gasless HTTP call — see {@link GaslessHttpFailureClass}.
 *
 * The status is read structurally, so an error a framework layer re-wrapped
 * (`@symmio/trading-react`'s `SymmioRequestError`, which copies `status` and
 * `responseData`) classifies exactly like the `SymmApiError` underneath it.
 *
 * @param err - Anything caught from a gasless HTTP call.
 * @returns The class, or `null` when `err` carries no HTTP status.
 *
 * @internal
 */
export function classifyGaslessHttpStatus(err: unknown): GaslessHttpFailureClass | null {
  const status = readGaslessErrorStatus(err);
  if (status === undefined) return null;
  const fromGateway = typeof parseGaslessErrorDetail(err)?.gatewayError === "string";
  switch (status) {
    case 0:
    case 408:
      return "ambiguous";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 422:
      return "client-schema";
    case 429:
      return "rate-limited";
    case 400:
      return fromGateway ? "selector-conflict" : "service";
    case 404:
      return fromGateway ? "unknown-instance" : "service";
    case 503:
      return fromGateway ? "gateway-not-ready" : "ambiguous";
    default:
      return status >= 500 ? "ambiguous" : "service";
  }
}

/**
 * Generate a random idempotency key for one gasless submit. Reuse the same key
 * only when retrying the byte-identical request; any change to the payload
 * needs a fresh key.
 */
export function generateGaslessIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}
