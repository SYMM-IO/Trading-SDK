import type { AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { SymmError } from "../shared/errors/symm-error";
import { assertGaslessInstance, buildGaslessHttpContext, resolveGaslessHttp } from "./http";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "./test/config";

const CHAIN = GASLESS_TEST_CHAIN;

function response(headers: Record<string, string>): AxiosResponse {
  return { headers } as unknown as AxiosResponse;
}

describe("buildGaslessHttpContext", () => {
  it("derives the instance-scoped service base from a vendor origin", () => {
    const context = buildGaslessHttpContext(CHAIN, TEST_GASLESS, "operations");

    expect(context.baseURL).toBe("https://gaslessq.symmio.foundation/v1/instances/arbitrum-42161-vibe/operations");
    expect(context.protocolInstance).toBe("arbitrum-42161-vibe");
    expect(context.headers.Authorization).toBe("Bearer test-key");
  });

  it("derives the deposits base from the same origin", () => {
    const context = buildGaslessHttpContext(CHAIN, TEST_GASLESS, "deposits");

    expect(context.baseURL).toBe("https://gaslessq.symmio.foundation/v1/instances/arbitrum-42161-vibe/deposits");
  });

  it("appends the service to an instance-root url and extracts the instance", () => {
    const context = buildGaslessHttpContext(
      CHAIN,
      { ...TEST_GASLESS, url: "https://gaslessq-staging.symmio.foundation/v1/instances/hyperevm-999-sandbox" },
      "operations",
    );

    expect(context.baseURL).toBe(
      "https://gaslessq-staging.symmio.foundation/v1/instances/hyperevm-999-sandbox/operations",
    );
    expect(context.protocolInstance).toBe("hyperevm-999-sandbox");
  });

  it("uses an already-scoped service base as-is", () => {
    const url = "https://gaslessq.symmio.foundation/v1/instances/arbitrum-42161-vibe/operations";
    const context = buildGaslessHttpContext(CHAIN, { ...TEST_GASLESS, url }, "operations");

    expect(context.baseURL).toBe(url);
  });

  it("rejects a service base bound to the other service", () => {
    const url = "https://gaslessq.symmio.foundation/v1/instances/arbitrum-42161-vibe/deposits";

    expect(() => buildGaslessHttpContext(CHAIN, { ...TEST_GASLESS, url }, "operations")).toThrowError(
      /GASLESS_URL_SERVICE_MISMATCH|deposits/,
    );
  });

  it("treats a pathed url as a proxy root: appends the service, skips instance pinning, omits auth when keyless", () => {
    const context = buildGaslessHttpContext(
      CHAIN,
      { url: "https://app.example/api/gasless", gaslessLayerAddress: TEST_GASLESS.gaslessLayerAddress },
      "operations",
    );

    expect(context.baseURL).toBe("https://app.example/api/gasless/operations");
    expect(context.protocolInstance).toBeNull();
    expect(context.headers.Authorization).toBeUndefined();
  });

  it("requires protocolInstance for a bare vendor origin", () => {
    expect(() =>
      buildGaslessHttpContext(
        CHAIN,
        { url: TEST_GASLESS.url, gaslessLayerAddress: TEST_GASLESS.gaslessLayerAddress },
        "operations",
      ),
    ).toThrowError(/GASLESS_PROTOCOL_INSTANCE_REQUIRED|protocolInstance/);
  });
});

describe("resolveGaslessHttp", () => {
  it("resolves through the chain's gasless block", () => {
    const { config } = gaslessTestConfig();

    const context = resolveGaslessHttp(config, { chainId: CHAIN, service: "operations" });

    expect(context.chainId).toBe(CHAIN);
    expect(context.baseURL).toContain("/operations");
  });
});

describe("assertGaslessInstance", () => {
  const context = buildGaslessHttpContext(CHAIN, TEST_GASLESS, "operations");

  it("accepts a matching response header", () => {
    expect(() =>
      assertGaslessInstance(context, response({ "x-gaslessq-protocol-instance": "arbitrum-42161-vibe" })),
    ).not.toThrow();
  });

  it("fails closed on a mismatching header", () => {
    expect(() =>
      assertGaslessInstance(context, response({ "x-gaslessq-protocol-instance": "arbitrum-42161-vibe-stage" })),
    ).toThrowError(SymmError);
  });

  it("fails closed on a missing header when the base pins an instance", () => {
    expect(() => assertGaslessInstance(context, response({}))).toThrowError(/GASLESS_INSTANCE_MISMATCH|pins/);
  });

  it("skips the assertion for proxy bases that pin no instance", () => {
    const proxyContext = buildGaslessHttpContext(
      CHAIN,
      { url: "https://app.example/api/gasless", gaslessLayerAddress: TEST_GASLESS.gaslessLayerAddress },
      "operations",
    );

    expect(() => assertGaslessInstance(proxyContext, response({}))).not.toThrow();
  });
});
