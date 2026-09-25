import type { SymmioGaslessConfig } from "../core/chains/types";
import { SymmError } from "../shared/errors/symm-error";
import type { GaslessService } from "./types";

/**
 * A chain's `gasless.url`, classified by form, with the protocol instance the
 * SDK expects responses from. Every URL-derived transport (HTTP bases, stream
 * endpoints) starts from this one parse, so the forms cannot drift apart.
 *
 * `url` is the configured value, trimmed of surrounding whitespace and
 * trailing slashes, and otherwise verbatim.
 *
 * @internal
 */
export type GaslessUrl =
  | {
      /** A bare gateway origin (`https://host`); services live under `/v1/instances/{protocolInstance}/{service}`. */
      form: "origin";
      url: string;
      /** The configured `protocolInstance`, which the origin form requires. */
      protocolInstance: string;
    }
  | {
      /** A gateway instance root (`…/v1/instances/{instance}`); services live under `/{service}`. */
      form: "instance-root";
      url: string;
      /** The instance the path pins. */
      protocolInstance: string;
    }
  | {
      /** An instance-pinned service base (`…/v1/instances/{instance}/{service}`), usable for that service only. */
      form: "service-base";
      url: string;
      /** The service the path pins. */
      service: GaslessService;
      /** The instance the path pins. */
      protocolInstance: string;
    }
  | {
      /** Any other path: a proxy (e.g. a server-side BFF) that forwards `/{service}/…` to the gateway. */
      form: "proxy-root";
      url: string;
      /**
       * The configured `protocolInstance`, or `null` when none is configured.
       * A proxy may strip the gateway's instance header, so it is checked only
       * when a response carries one.
       */
      protocolInstance: string | null;
    };

/** `…/v1/instances/{instance}/{service}` — the instance and service a base pins. */
const SERVICE_BASE_PATH = /\/v1\/instances\/([^/]+)\/(operations|deposits)$/i;
/** `…/v1/instances/{instance}` — the instance a root pins. */
const INSTANCE_ROOT_PATH = /\/v1\/instances\/([^/]+)$/i;
/** `…/v1/operations` / `…/v1/deposits` — the instance-less compatibility routes. */
const LEGACY_SERVICE_PATH = /\/v1\/(?:operations|deposits)$/i;
/**
 * A URL that names its own scheme (`https:`, `wss:`, or a mistyped `localhost:`).
 * Anything else, including a protocol-relative `//host`, resolves like a
 * browser would: against the page's origin.
 */
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

function invalidUrl(chainId: number, reason: string): SymmError {
  return new SymmError(
    "config",
    "GASLESS_URL_INVALID",
    `Gasless: chain ${chainId} has an invalid gasless url: ${reason}.`,
  );
}

/**
 * Decode the instance segment a gateway path pins.
 *
 * @throws {SymmError} `GASLESS_URL_INVALID` on malformed percent-encoding.
 */
function decodeInstance(chainId: number, segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw invalidUrl(chainId, "the protocol-instance segment is not valid percent-encoding");
  }
}

/**
 * Check a path-pinned instance against the configured `protocolInstance`.
 *
 * @throws {SymmError} `GASLESS_PROTOCOL_INSTANCE_CONFLICT` when both are set and differ.
 */
function assertNoInstanceConflict(chainId: number, pinned: string, configured?: string): void {
  if (configured && configured !== pinned) {
    throw new SymmError(
      "config",
      "GASLESS_PROTOCOL_INSTANCE_CONFLICT",
      `Gasless: chain ${chainId} declares protocolInstance "${configured}", but its gasless url pins instance "${pinned}". Remove one of them or make them match. They must name the same deployment.`,
    );
  }
}

/**
 * Parse a chain's gasless `url` into one of the supported forms.
 *
 * - **Origin** (no path): needs `protocolInstance`.
 * - **Instance root** (`…/v1/instances/{instance}`): the path pins the instance.
 * - **Service base** (`…/v1/instances/{instance}/{operations|deposits}`): pins the instance and one service.
 * - **Proxy root** (any other path, absolute or relative): pins nothing itself.
 *
 * The instance-less `…/v1/operations` / `…/v1/deposits` compatibility routes
 * are rejected. They resolve through a gateway default the vendor is retiring,
 * and pin no instance to verify responses against. A query string or fragment
 * is rejected too, because the SDK appends service paths to the URL, and so are
 * credentials in the URL, which would otherwise ride along into logs and errors.
 *
 * Error messages never echo the URL, which may carry credentials.
 *
 * @param chainId - The chain the config belongs to (for error messages).
 * @param gasless - The chain's `url` and optional `protocolInstance`.
 * @returns The classified URL.
 * @throws {SymmError} `GASLESS_URL_INVALID` for an empty, unparseable, non-HTTP(S), query-, fragment- or credential-bearing url.
 * @throws {SymmError} `GASLESS_URL_LEGACY_ROUTE` for an instance-less `/v1/{service}` base.
 * @throws {SymmError} `GASLESS_PROTOCOL_INSTANCE_REQUIRED` for an origin without `protocolInstance`.
 * @throws {SymmError} `GASLESS_PROTOCOL_INSTANCE_CONFLICT` when the path pins a different instance than `protocolInstance`.
 *
 * @internal
 */
export function parseGaslessUrl(
  chainId: number,
  gasless: Pick<SymmioGaslessConfig, "url" | "protocolInstance">,
): GaslessUrl {
  const url = gasless.url.trim().replace(/\/+$/, "");
  if (url === "") throw invalidUrl(chainId, "it is empty");
  if (/[?#]/.test(url)) {
    throw invalidUrl(chainId, "it carries a query string or fragment, and the SDK appends service paths to it");
  }

  const absolute = HAS_SCHEME.test(url) || url.startsWith("//");
  let parsed: URL;
  try {
    parsed = HAS_SCHEME.test(url) ? new URL(url) : new URL(url, "https://relative.invalid");
  } catch {
    throw invalidUrl(chainId, "it cannot be parsed");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw invalidUrl(chainId, `it uses the "${parsed.protocol}" scheme instead of https or http`);
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw invalidUrl(chainId, "it carries credentials (user:password@). Pass a partner key as `apiKey` instead");
  }

  const path = parsed.pathname.replace(/\/+$/, "");
  const configured = gasless.protocolInstance || undefined;

  const serviceBase = SERVICE_BASE_PATH.exec(path);
  if (serviceBase) {
    const [, segment = "", serviceName = ""] = serviceBase;
    const protocolInstance = decodeInstance(chainId, segment);
    assertNoInstanceConflict(chainId, protocolInstance, configured);
    const service: GaslessService = serviceName.toLowerCase() === "operations" ? "operations" : "deposits";
    return { form: "service-base", url, service, protocolInstance };
  }

  const instanceRoot = INSTANCE_ROOT_PATH.exec(path);
  if (instanceRoot) {
    const [, segment = ""] = instanceRoot;
    const protocolInstance = decodeInstance(chainId, segment);
    assertNoInstanceConflict(chainId, protocolInstance, configured);
    return { form: "instance-root", url, protocolInstance };
  }

  if (LEGACY_SERVICE_PATH.test(path)) {
    throw new SymmError(
      "config",
      "GASLESS_URL_LEGACY_ROUTE",
      `Gasless: chain ${chainId} points its gasless url at an instance-less /v1/operations or /v1/deposits route. Those compatibility routes are being retired and pin no protocol instance. Use the gateway origin with \`protocolInstance\` instead.`,
    );
  }

  if (path === "") {
    if (!absolute) throw invalidUrl(chainId, "a relative url must name a proxy path");
    if (!configured) {
      throw new SymmError(
        "config",
        "GASLESS_PROTOCOL_INSTANCE_REQUIRED",
        `Gasless: chain ${chainId} points its gasless url at a gateway origin but declares no \`protocolInstance\`. The instance key selects the deployment and cannot be derived.`,
      );
    }
    return { form: "origin", url, protocolInstance: configured };
  }

  return { form: "proxy-root", url, protocolInstance: configured ?? null };
}

/**
 * Check that a URL can serve `service`: a service base pins exactly one.
 *
 * @param chainId - The chain the config belongs to (for error messages).
 * @param url - The parsed gasless url.
 * @param service - The service about to be called.
 * @throws {SymmError} `GASLESS_URL_SERVICE_MISMATCH` when a service base pins the other service.
 *
 * @internal
 */
export function assertGaslessUrlServes(chainId: number, url: GaslessUrl, service: GaslessService): void {
  if (url.form === "service-base" && url.service !== service) {
    throw new SymmError(
      "config",
      "GASLESS_URL_SERVICE_MISMATCH",
      `Gasless: chain ${chainId} configures a "${url.service}" service base, but the "${service}" service was requested. Point \`gasless.url\` at the gateway origin (or an instance root) so both services can be derived.`,
    );
  }
}
