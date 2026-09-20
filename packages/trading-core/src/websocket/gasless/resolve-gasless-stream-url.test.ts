import { describe, expect, it } from "vitest";
import type { SymmioGaslessConfig } from "../../core/chains/types";
import { TEST_GASLESS } from "../../gasless/test/config";
import { SymmError } from "../../shared/errors/symm-error";
import { canResolveGaslessStreamUrl, resolveGaslessStreamUrl } from "./resolve-gasless-stream-url";

const CHAIN_ID = 42161;
const ORIGIN = "https://gateway.invalid";
/** The deployment facts under test come from the shared gasless fixture. */
const INSTANCE = TEST_GASLESS.protocolInstance as string;

function gasless(overrides: Partial<SymmioGaslessConfig> = {}): SymmioGaslessConfig {
  return {
    url: ORIGIN,
    protocolInstance: INSTANCE,
    gaslessLayerAddress: TEST_GASLESS.gaslessLayerAddress,
    statusStream: { enabled: true },
    ...overrides,
  };
}

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (err) {
    return err instanceof SymmError ? err.code : `unexpected ${String(err)}`;
  }
  return "no throw";
}

describe("resolveGaslessStreamUrl", () => {
  it("derives the wss endpoint from a gateway origin", () => {
    const endpoint = resolveGaslessStreamUrl(CHAIN_ID, gasless(), "operations");

    expect(endpoint).toEqual({
      url: `wss://gateway.invalid/v1/instances/${INSTANCE}/operations/ws`,
      protocolInstance: INSTANCE,
      service: "operations",
      chainId: CHAIN_ID,
    });
  });

  it("keeps an insecure origin on ws:, for a local gateway", () => {
    const endpoint = resolveGaslessStreamUrl(CHAIN_ID, gasless({ url: "http://localhost:8080" }), "deposits");

    expect(endpoint.url).toBe(`ws://localhost:8080/v1/instances/${INSTANCE}/deposits/ws`);
  });

  it("appends the service to an instance root", () => {
    const url = `${ORIGIN}/v1/instances/${INSTANCE}`;

    expect(resolveGaslessStreamUrl(CHAIN_ID, gasless({ url }), "deposits").url).toBe(
      `wss://gateway.invalid/v1/instances/${INSTANCE}/deposits/ws`,
    );
  });

  it("appends /ws to a service base, and rejects the other service", () => {
    const url = `${ORIGIN}/v1/instances/${INSTANCE}/operations`;

    expect(resolveGaslessStreamUrl(CHAIN_ID, gasless({ url }), "operations").url).toBe(
      `wss://gateway.invalid/v1/instances/${INSTANCE}/operations/ws`,
    );
    expect(codeOf(() => resolveGaslessStreamUrl(CHAIN_ID, gasless({ url }), "deposits"))).toBe(
      "GASLESS_URL_SERVICE_MISMATCH",
    );
  });

  it("streams from statusStream.origin when HTTP goes through a proxy", () => {
    const config = gasless({ url: "/api/gasless", statusStream: { enabled: true, origin: ORIGIN } });

    expect(resolveGaslessStreamUrl(CHAIN_ID, config, "operations").url).toBe(
      `wss://gateway.invalid/v1/instances/${INSTANCE}/operations/ws`,
    );
  });

  it("refuses to guess a stream endpoint for a proxy root", () => {
    expect(codeOf(() => resolveGaslessStreamUrl(CHAIN_ID, gasless({ url: "/api/gasless" }), "operations"))).toBe(
      "GASLESS_STREAM_ORIGIN_REQUIRED",
    );
  });

  it("requires a protocol instance behind a proxy, since every frame is checked against it", () => {
    const config = gasless({
      url: "/api/gasless",
      protocolInstance: undefined,
      statusStream: { enabled: true, origin: ORIGIN },
    });

    expect(codeOf(() => resolveGaslessStreamUrl(CHAIN_ID, config, "operations"))).toBe(
      "GASLESS_PROTOCOL_INSTANCE_REQUIRED",
    );
  });

  it("rejects an origin that carries a path", () => {
    const config = gasless({
      url: "/api/gasless",
      statusStream: { enabled: true, origin: `${ORIGIN}/v1/instances/${INSTANCE}` },
    });

    expect(codeOf(() => resolveGaslessStreamUrl(CHAIN_ID, config, "operations"))).toBe(
      "GASLESS_STREAM_ORIGIN_REQUIRED",
    );
  });

  it("rejects an origin set alongside a gateway url, so one place names the gateway", () => {
    const config = gasless({ statusStream: { enabled: true, origin: "https://other.invalid" } });

    expect(codeOf(() => resolveGaslessStreamUrl(CHAIN_ID, config, "operations"))).toBe(
      "GASLESS_STREAM_ORIGIN_CONFLICT",
    );
  });

  it("treats an absent or disabled statusStream as not configured", () => {
    expect(codeOf(() => resolveGaslessStreamUrl(CHAIN_ID, gasless({ statusStream: undefined }), "operations"))).toBe(
      "GASLESS_STREAM_NOT_CONFIGURED",
    );
    expect(
      codeOf(() => resolveGaslessStreamUrl(CHAIN_ID, gasless({ statusStream: { enabled: false } }), "operations")),
    ).toBe("GASLESS_STREAM_NOT_CONFIGURED");
  });

  it("percent-encodes the instance segment", () => {
    const config = gasless({ protocolInstance: "arbitrum 42161/test" });

    expect(resolveGaslessStreamUrl(CHAIN_ID, config, "operations").url).toBe(
      "wss://gateway.invalid/v1/instances/arbitrum%2042161%2Ftest/operations/ws",
    );
  });
});

describe("canResolveGaslessStreamUrl", () => {
  it("answers without throwing", () => {
    expect(canResolveGaslessStreamUrl(CHAIN_ID, gasless(), "operations")).toBe(true);
    expect(canResolveGaslessStreamUrl(CHAIN_ID, gasless({ statusStream: { enabled: false } }), "operations")).toBe(
      false,
    );
    expect(canResolveGaslessStreamUrl(CHAIN_ID, gasless({ url: "/api/gasless" }), "operations")).toBe(false);
  });
});
