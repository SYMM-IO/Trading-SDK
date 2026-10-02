import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";

const EXPRESS_WITHDRAW_STAGING_ROOT = "https://express-withdraw-staging.symmio.foundation/v1";

function isAllowedRequest(method: string, path: string[]): boolean {
  if (method === "POST") return path.length === 1 && path[0] === "options";
  return (
    method === "GET" &&
    path.length === 3 &&
    path[0] === "status" &&
    isAddress(path[1] ?? "") &&
    /^\d+$/.test(path[2] ?? "")
  );
}

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (!isAllowedRequest(request.method, path)) {
    return NextResponse.json({ error: "Express Withdraw endpoint not allowed" }, { status: 404 });
  }

  const upstreamUrl = `${EXPRESS_WITHDRAW_STAGING_ROOT}/${path.map(encodeURIComponent).join("/")}`;
  const body = request.method === "POST" ? await request.text() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body }),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`Express Withdraw proxy could not reach ${upstreamUrl}:`, error);
    return NextResponse.json({ error: "Express Withdraw upstream unreachable" }, { status: 502 });
  }

  const payload = await upstream.text();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

/** Forward an allowlisted Express Withdraw status read. */
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

/** Forward an allowlisted Express Withdraw options request. */
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}
