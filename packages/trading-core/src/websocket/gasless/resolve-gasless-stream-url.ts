import type { SymmioGaslessConfig } from "../../core/chains/types";
import { assertGaslessUrlServes, parseGaslessUrl } from "../../gasless/gasless-url";
import type { GaslessService } from "../../gasless/types";
import { SymmError } from "../../shared/errors/symm-error";

/**
 * A resolved status-stream endpoint: the `ws(s)://` URL to dial and the
 * protocol instance every message from it must name.
 *
 * @internal
 */
export interface GaslessStreamEndpoint {
  /** Full stream URL, `…/v1/instances/{instance}/{service}/ws`. */
  url: string;
  /** The instance the endpoint pins; the `ready` frame is checked against it. */
  protocolInstance: string;
  /** The service the stream carries. */
  service: GaslessService;
  /** The chain the endpoint was resolved for (for error messages and hub keys). */
  chainId: number;
}

/** Swap an `http(s)` scheme for its WebSocket counterpart. */
function toWebSocketScheme(url: string): string {
  return url.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
}

function streamError(code: string, message: string): SymmError {
  return new SymmError("config", code, message);
}

/**
 * Resolve the status-stream endpoint for one `(chain, service)`.
 *
 * The stream shares the gateway's URL forms with HTTP, so both start from
 * {@link parseGaslessUrl}:
 *
 * - **origin** → `wss://host/v1/instances/{instance}/{service}/ws`
 * - **instance root** → the same, with the configured path
 * - **service base** → `{url}/ws`, for that service only
 * - **proxy root** → only from `statusStream.origin`, because a proxy that
 *   forwards HTTP cannot be assumed to forward a WebSocket upgrade, and a
 *   relative proxy path has no host core could turn into `ws(s)` without a
 *   browser global
 *
 * The stream is anonymous: a browser `WebSocket` cannot send an `Authorization`
 * header, so `apiKey` never reaches it. A partner key raises HTTP limits only.
 *
 * @param chainId - The chain the config belongs to.
 * @param gasless - The chain's gasless config.
 * @param service - Which service's stream to resolve.
 * @returns The endpoint to dial.
 * @throws {SymmError} `GASLESS_STREAM_NOT_CONFIGURED` when `statusStream` is absent or disabled.
 * @throws {SymmError} `GASLESS_STREAM_ORIGIN_REQUIRED` for a proxy root with no `statusStream.origin`.
 * @throws {SymmError} `GASLESS_STREAM_ORIGIN_CONFLICT` when `origin` is set on a gateway url form.
 * @throws {SymmError} `GASLESS_PROTOCOL_INSTANCE_REQUIRED` when a proxy root declares no `protocolInstance`.
 * @throws {SymmError} Every {@link parseGaslessUrl} config error, plus `GASLESS_URL_SERVICE_MISMATCH`.
 *
 * @internal
 */
export function resolveGaslessStreamUrl(
  chainId: number,
  gasless: SymmioGaslessConfig,
  service: GaslessService,
): GaslessStreamEndpoint {
  if (!gasless.statusStream?.enabled) {
    throw streamError(
      "GASLESS_STREAM_NOT_CONFIGURED",
      `Gasless: chain ${chainId} does not enable the status stream. Set \`gasless.statusStream.enabled\` once operators confirm the WebSocket for this deployment; until then status reads poll over HTTP.`,
    );
  }

  const parsed = parseGaslessUrl(chainId, gasless);
  assertGaslessUrlServes(chainId, parsed, service);
  const origin = gasless.statusStream.origin?.trim().replace(/\/+$/, "");

  if (parsed.form === "proxy-root") {
    if (!origin) {
      throw streamError(
        "GASLESS_STREAM_ORIGIN_REQUIRED",
        `Gasless: chain ${chainId} routes HTTP through a proxy, so the status stream needs \`gasless.statusStream.origin\` — the gateway's own origin. A proxy that forwards HTTP does not necessarily forward a WebSocket upgrade, and the stream is anonymous either way.`,
      );
    }
    if (!parsed.protocolInstance) {
      throw streamError(
        "GASLESS_PROTOCOL_INSTANCE_REQUIRED",
        `Gasless: chain ${chainId} streams from \`statusStream.origin\` but declares no \`protocolInstance\`. The instance key selects the deployment and is checked on every stream message.`,
      );
    }
    const base = parseGaslessUrl(chainId, { url: origin, protocolInstance: parsed.protocolInstance });
    if (base.form !== "origin") {
      throw streamError(
        "GASLESS_STREAM_ORIGIN_REQUIRED",
        `Gasless: chain ${chainId} sets \`gasless.statusStream.origin\` to a url with a path. It must be the gateway's bare origin; the SDK appends the instance and service path itself.`,
      );
    }
    return {
      url: `${toWebSocketScheme(base.url)}/v1/instances/${encodeURIComponent(base.protocolInstance)}/${service}/ws`,
      protocolInstance: base.protocolInstance,
      service,
      chainId,
    };
  }

  if (origin) {
    throw streamError(
      "GASLESS_STREAM_ORIGIN_CONFLICT",
      `Gasless: chain ${chainId} sets \`gasless.statusStream.origin\` while its \`url\` already names the gateway. Remove the origin — the stream derives from \`url\` — or point \`url\` at your proxy.`,
    );
  }

  const base = toWebSocketScheme(parsed.url);
  if (parsed.form === "origin") {
    return {
      url: `${base}/v1/instances/${encodeURIComponent(parsed.protocolInstance)}/${service}/ws`,
      protocolInstance: parsed.protocolInstance,
      service,
      chainId,
    };
  }
  if (parsed.form === "instance-root") {
    return { url: `${base}/${service}/ws`, protocolInstance: parsed.protocolInstance, service, chainId };
  }
  return { url: `${base}/ws`, protocolInstance: parsed.protocolInstance, service, chainId };
}

/**
 * Whether `(chain, service)` has a status stream the SDK can dial.
 *
 * Non-throwing companion to {@link resolveGaslessStreamUrl}: a consumer can ask
 * before subscribing, and fall back to HTTP polling when the answer is `false`.
 *
 * @internal
 */
export function canResolveGaslessStreamUrl(
  chainId: number,
  gasless: SymmioGaslessConfig,
  service: GaslessService,
): boolean {
  try {
    resolveGaslessStreamUrl(chainId, gasless, service);
    return true;
  } catch {
    return false;
  }
}
