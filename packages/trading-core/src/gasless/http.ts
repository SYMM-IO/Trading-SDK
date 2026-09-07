import axios, { isAxiosError, type AxiosResponse } from "axios";
import type { SymmioGaslessConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import { resolveGaslessService } from "./resolve-gasless";
import type { GaslessService } from "./types";

/**
 * A resolved gasless HTTP context for one `(chain, service)` pair: the final
 * per-service base URL, the auth headers, and the protocol instance the base
 * pins (when it pins one).
 *
 * @internal
 */
export interface GaslessHttpContext {
  /** Final service base, e.g. `…/v1/instances/arbitrum-42161-vibe/operations`. */
  baseURL: string;
  /** Request headers (Accept + optional bearer). */
  headers: Record<string, string>;
  /**
   * Protocol instance the base URL encodes, when known. Vendor-form bases pin
   * one and every 2xx response is asserted against it; proxy-form bases hide
   * the instance behind the proxy and skip the assertion.
   */
  protocolInstance: string | null;
  /** The chain the context was resolved for (for error messages and events). */
  chainId: number;
}

const SERVICE_BASE_PATTERN = /\/v1\/(?:instances\/[^/]+\/)?(?:operations|deposits)$/i;
const INSTANCE_ROOT_PATTERN = /\/v1\/instances\/([^/]+)$/i;
const INSTANCE_SEGMENT_PATTERN = /\/v1\/instances\/([^/]+)\//i;

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Derive the per-service base URL from a chain's gasless config.
 *
 * Accepted `url` forms:
 * - a vendor **origin** (no path) — requires `protocolInstance`; the SDK
 *   appends `/v1/instances/{protocolInstance}/{service}`;
 * - an **instance root** ending in `/v1/instances/{pi}` — the SDK appends
 *   `/{service}`;
 * - an already-scoped **service base** ending in `/operations` or `/deposits`
 *   — used as-is, and it must match the requested service;
 * - any other **proxy root** (a non-empty path, e.g. `/api/gasless`) — the SDK
 *   appends `/{service}` and skips instance assertions (the proxy owns them).
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

/** Build a {@link GaslessHttpContext} from an already-resolved gasless block. @internal */
export function buildGaslessHttpContext(
  chainId: number,
  gasless: SymmioGaslessConfig,
  service: GaslessService,
): GaslessHttpContext {
  const url = trimTrailingSlashes(gasless.url.trim());
  let parsed: URL;
  try {
    parsed = new URL(url, "https://gasless.invalid");
  } catch {
    throw new SymmError("config", "GASLESS_URL_INVALID", `Gasless: chain ${chainId} has an unparseable gasless url.`);
  }
  const pathname = trimTrailingSlashes(parsed.pathname);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (gasless.apiKey) headers.Authorization = `Bearer ${gasless.apiKey}`;

  const serviceMatch = pathname.match(SERVICE_BASE_PATTERN);
  if (serviceMatch) {
    const boundService = pathname.toLowerCase().endsWith("/operations") ? "operations" : "deposits";
    if (boundService !== service) {
      throw new SymmError(
        "config",
        "GASLESS_URL_SERVICE_MISMATCH",
        `Gasless: chain ${chainId} configures a "${boundService}" base URL, but the "${service}" service was requested. Point \`gasless.url\` at the origin (or instance root) so both services can be derived.`,
      );
    }
    const pinnedInstance = pathname.match(INSTANCE_SEGMENT_PATTERN)?.[1];
    return {
      baseURL: url,
      headers,
      protocolInstance: pinnedInstance ?? null,
      chainId,
    };
  }

  const instanceRoot = pathname.match(INSTANCE_ROOT_PATTERN);
  if (instanceRoot) {
    return { baseURL: `${url}/${service}`, headers, protocolInstance: instanceRoot[1] ?? null, chainId };
  }

  if (pathname === "" || pathname === "/") {
    if (!gasless.protocolInstance) {
      throw new SymmError(
        "config",
        "GASLESS_PROTOCOL_INSTANCE_REQUIRED",
        `Gasless: chain ${chainId} points \`gasless.url\` at a vendor origin but declares no \`protocolInstance\` — the instance key selects the deployment and cannot be derived.`,
      );
    }
    return {
      baseURL: `${url}/v1/instances/${encodeURIComponent(gasless.protocolInstance)}/${service}`,
      headers,
      protocolInstance: gasless.protocolInstance,
      chainId,
    };
  }

  /** Proxy root with an arbitrary path: the proxy owns instance pinning. */
  return { baseURL: `${url}/${service}`, headers, protocolInstance: null, chainId };
}

/**
 * Assert that a successful response came from the protocol instance the base
 * URL pins. The gateway stamps `X-GasLessQ-Protocol-Instance` on every
 * response it routes; a mismatch — or a missing header on an instance-pinned
 * base — means the request was answered by a different deployment (a
 * staging/production cross-wire) and must not be trusted. Fail-closed, like
 * the reference implementation.
 *
 * @internal
 * @throws {SymmError} `GASLESS_INSTANCE_MISMATCH`
 */
export function assertGaslessInstance(context: GaslessHttpContext, response: AxiosResponse): void {
  if (!context.protocolInstance) return;
  const actual = response.headers?.["x-gaslessq-protocol-instance"];
  if (actual !== context.protocolInstance) {
    throw new SymmError(
      "api",
      "GASLESS_INSTANCE_MISMATCH",
      `Gasless: response came from protocol instance "${String(actual ?? "<missing>")}" but the base URL pins "${context.protocolInstance}". Check the gasless url/protocolInstance pairing.`,
    );
  }
}

/**
 * Perform a gasless GET and normalize failures into the house error shape.
 *
 * @internal
 */
export async function gaslessGet<data>(context: GaslessHttpContext, path: string, code: string): Promise<data> {
  try {
    const response = await axios.get<data>(path, { baseURL: context.baseURL, headers: context.headers });
    assertGaslessInstance(context, response);
    return response.data;
  } catch (err) {
    throw toGaslessError(err, context, code);
  }
}

/**
 * Perform a gasless POST and normalize failures into the house error shape.
 *
 * @internal
 */
export async function gaslessPost<data>(
  context: GaslessHttpContext,
  path: string,
  body: unknown,
  code: string,
): Promise<data> {
  try {
    const response = await axios.post<data>(path, body, {
      baseURL: context.baseURL,
      headers: { ...context.headers, "Content-Type": "application/json" },
    });
    assertGaslessInstance(context, response);
    return response.data;
  } catch (err) {
    throw toGaslessError(err, context, code);
  }
}

/** The canonical 3-branch error normalization every gasless HTTP call shares. @internal */
export function toGaslessError(err: unknown, context: GaslessHttpContext, code: string): Error {
  if (err instanceof SymmError) return err;
  if (isAxiosError(err)) return SymmApiError.fromAxios(err, { code, baseURL: context.baseURL });
  return new SymmError("api", code, `Gasless request failed: ${err instanceof Error ? err.message : String(err)}`, {
    cause: err instanceof Error ? err : undefined,
  });
}

/**
 * Whether an error represents a network-level or 5xx failure where the service
 * may or may not have accepted the request — the only submit failures that are
 * safe to retry **with the same idempotency key** (idempotent by contract).
 *
 * @internal
 */
export function isRetryableGaslessSubmitError(err: unknown): boolean {
  /** `fromAxios` maps a network error (no HTTP response) to `status: 0`. */
  if (err instanceof SymmApiError) return err.status === 0 || err.status >= 500;
  if (err instanceof SymmError) return false;
  return isAxiosError(err) && err.response === undefined;
}

/**
 * Generate a random idempotency key for one gasless submit. Reuse the same key
 * only when retrying the byte-identical request; any change to the payload
 * needs a fresh key.
 */
export function generateGaslessIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}
