import { NextResponse, type NextRequest } from "next/server";

/**
 * Reference same-origin proxy for the GaslessQ service.
 *
 * The gateway client key is a secret and must never reach a browser bundle, so
 * browser consumers point the SDK's `gasless.url` at this route instead of the
 * vendor origin. The SDK appends `/operations` or `/deposits` plus the endpoint
 * path; this handler rebuilds the instance-scoped upstream URL, injects the
 * `Authorization` header server-side, and pins the protocol instance by
 * asserting the `X-GasLessQ-Protocol-Instance` response header.
 *
 * The first path segment names the **deployment**, so `gasless.url` is
 * `/api/gasless/staging` or `/api/gasless/production`. That segment is what
 * makes a cross-wire impossible: under the proxy URL form the SDK sets
 * `protocolInstance` to `null` and skips its own instance assertion, so this
 * route is the only place the deployment can be enforced. A client configured
 * for one deployment can never reach the other's gateway, and a deployment this
 * server holds no key for answers 503 instead of relaying signatures the wrong
 * gateway would have to reject.
 *
 * Environment (server-only — never `NEXT_PUBLIC_`), per deployment:
 * - `GASLESSQ_<DEPLOYMENT>_ORIGIN`             e.g. `https://gaslessq.symmio.foundation`
 * - `GASLESSQ_<DEPLOYMENT>_PROTOCOL_INSTANCE`  e.g. `arbitrum-42161-vibe`
 * - `GASLESSQ_<DEPLOYMENT>_API_KEY`            that deployment's gateway client key
 *
 * A production deployment should add its own auth, rate limits, and payload
 * validation in front of this — the proxy is the app's trust boundary.
 */

const FORWARDED_METHODS = new Set(["GET", "POST"]);
const DEPLOYMENTS = ["staging", "production"] as const;
const SERVICES = ["operations", "deposits"] as const;

type Deployment = (typeof DEPLOYMENTS)[number];
type Service = (typeof SERVICES)[number];

interface UpstreamConfig {
  origin: string;
  protocolInstance: string;
  apiKey: string;
}

function isDeployment(value: string | undefined): value is Deployment {
  return DEPLOYMENTS.includes(value as Deployment);
}

function isService(value: string | undefined): value is Service {
  return SERVICES.includes(value as Service);
}

/** Read one deployment's env trio. Returns `null` unless all three are set. */
function readUpstreamConfig(deployment: Deployment): UpstreamConfig | null {
  const prefix = `GASLESSQ_${deployment.toUpperCase()}`;
  const origin = process.env[`${prefix}_ORIGIN`]?.replace(/\/+$/, "");
  const protocolInstance = process.env[`${prefix}_PROTOCOL_INSTANCE`];
  const apiKey = process.env[`${prefix}_API_KEY`];
  if (!origin || !protocolInstance || !apiKey) return null;
  return { origin, protocolInstance, apiKey };
}

async function proxy(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  if (!FORWARDED_METHODS.has(request.method)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  /** The SDK sends `<deployment>/<service>/<endpoint…>`. */
  const [deployment, service, ...rest] = pathSegments;
  if (!isDeployment(deployment)) {
    return NextResponse.json({ error: "Unknown gasless deployment" }, { status: 404 });
  }
  if (!isService(service)) {
    return NextResponse.json({ error: "Unknown gasless service" }, { status: 404 });
  }

  const upstreamConfig = readUpstreamConfig(deployment);
  if (!upstreamConfig) {
    return NextResponse.json(
      { error: `Gasless proxy is not configured for the ${deployment} deployment` },
      { status: 503 },
    );
  }
  const { origin, protocolInstance, apiKey } = upstreamConfig;

  const upstreamUrl = `${origin}/v1/instances/${encodeURIComponent(protocolInstance)}/${service}/${rest
    .map(encodeURIComponent)
    .join("/")}`;

  const body = request.method === "POST" ? await request.text() : undefined;
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body } : {}),
    cache: "no-store",
  });

  /** Fail closed on a routing mismatch — the only guard against a cross-wire. */
  const actualInstance = upstream.headers.get("x-gaslessq-protocol-instance");
  if (upstream.ok && actualInstance !== protocolInstance) {
    return NextResponse.json({ error: "Gasless routing mismatch" }, { status: 502 });
  }

  const payload = await upstream.text();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      ...(actualInstance ? { "X-GasLessQ-Protocol-Instance": actualInstance } : {}),
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}
