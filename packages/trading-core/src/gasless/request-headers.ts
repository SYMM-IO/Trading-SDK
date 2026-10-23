import type { GaslessRequestContext } from "../core/chains/types";
import { SymmError } from "../shared/errors/symm-error";
import type { GaslessHttpContext } from "./http";

/** Resolve fresh credentials without retaining application errors or mutating the shared context. */
export async function resolveGaslessRequestHeaders(
  context: GaslessHttpContext,
  method: GaslessRequestContext["method"],
) {
  try {
    const headers = { ...context.headers };

    function setHeader(name: string, value: string): void {
      for (const existing of Object.keys(headers)) {
        if (existing.toLowerCase() === name.toLowerCase()) delete headers[existing];
      }
      Object.defineProperty(headers, name, { value, enumerable: true, configurable: true, writable: true });
    }

    if (context.getRequestHeaders) {
      const additional = await context.getRequestHeaders({
        chainId: context.chainId,
        service: context.service,
        method,
      });
      for (const [name, value] of Object.entries(additional)) {
        if (!/^[!#$%&'*+.^_`|~\w-]+$/.test(name) || typeof value !== "string" || /[\r\n\0]/.test(value)) {
          throw new Error("Invalid application header");
        }
        setHeader(name, value);
      }
    }
    setHeader("Accept", "application/json");
    if (method === "POST") setHeader("Content-Type", "application/json");
    return headers;
  } catch {
    // A callback or getter may throw credentials in its message/cause. Never retain it.
    throw new SymmError(
      "config",
      "GASLESS_REQUEST_HEADERS_FAILED",
      "Gasless: application request headers could not be resolved. No request was sent by this attempt; preserve any earlier pending submission for recovery.",
    );
  }
}
