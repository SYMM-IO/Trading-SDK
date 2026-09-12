import type { AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import {
  assertGaslessInstance,
  buildGaslessHttpContext,
  generateGaslessIdempotencyKey,
  isRetryableGaslessSubmitError,
  resolveGaslessHttp,
  toGaslessError,
} from "./http";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "./test/config";

const CHAIN = GASLESS_TEST_CHAIN;

function response(headers: Record<string, string>): AxiosResponse {
  return { headers } as unknown as AxiosResponse;
}

function apiError(status: number): SymmApiError {
  return new SymmApiError({
    code: "GASLESS_RELAY_SUBMIT_FAILED",
    message: `HTTP ${status}`,
    status,
    statusText: "",
    url: "https://gasless.test/gateway/relay-instant",
    method: "POST",
  });
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

  it("uses a service base with no instance segment as-is and pins no instance", () => {
    const url = "https://gasless.example/v1/operations";

    const context = buildGaslessHttpContext(CHAIN, { ...TEST_GASLESS, url }, "operations");

    expect(context.baseURL).toBe(url);
    expect(context.protocolInstance).toBeNull();
  });

  it("rejects an unparseable url with a typed config error", () => {
    expect(() => buildGaslessHttpContext(CHAIN, { ...TEST_GASLESS, url: "https://[" }, "operations")).toThrow(
      expect.objectContaining({ kind: "config", code: "GASLESS_URL_INVALID" }),
    );
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

describe("toGaslessError", () => {
  const context = buildGaslessHttpContext(CHAIN, TEST_GASLESS, "operations");

  it("passes an SDK error through untouched", () => {
    const err = new SymmError("api", "GASLESS_INSTANCE_MISMATCH", "wrong instance");

    expect(toGaslessError(err, context, "GASLESS_RELAY_SUBMIT_FAILED")).toBe(err);
  });

  it("normalizes an axios error into a SymmApiError under the call's code", () => {
    const vendorBody = { detail: { code: "FEE_POLICY_WOULD_REVERT" } };

    const normalized = toGaslessError(
      {
        isAxiosError: true,
        message: "conflict",
        response: { status: 409, statusText: "Conflict", data: vendorBody },
        config: { url: "/gateway/relay-instant", method: "post" },
      },
      context,
      "GASLESS_RELAY_SUBMIT_FAILED",
    );

    expect(normalized).toBeInstanceOf(SymmApiError);
    expect(normalized).toMatchObject({
      code: "GASLESS_RELAY_SUBMIT_FAILED",
      status: 409,
      responseData: vendorBody,
      url: `${context.baseURL}/gateway/relay-instant`,
      method: "POST",
    });
  });

  it("wraps any other error in a SymmError that keeps the original as its cause", () => {
    const cause = new TypeError("adapter exploded");

    const normalized = toGaslessError(cause, context, "GASLESS_RELAY_SUBMIT_FAILED");

    expect(normalized).toBeInstanceOf(SymmError);
    expect(normalized).not.toBeInstanceOf(SymmApiError);
    expect(normalized).toMatchObject({ code: "GASLESS_RELAY_SUBMIT_FAILED" });
    expect(normalized.message).toContain("adapter exploded");
    expect(normalized.cause).toBe(cause);
  });

  it("describes a non-Error throw without inventing a cause", () => {
    const normalized = toGaslessError("socket closed", context, "GASLESS_STATUS_FETCH_FAILED");

    expect(normalized).toMatchObject({ code: "GASLESS_STATUS_FETCH_FAILED" });
    expect(normalized.message).toContain("socket closed");
    expect(normalized.cause).toBeUndefined();
  });
});

describe("isRetryableGaslessSubmitError", () => {
  it.each([
    { label: "a network failure normalized to status 0", err: apiError(0), retryable: true },
    { label: "a 500", err: apiError(500), retryable: true },
    { label: "a 503", err: apiError(503), retryable: true },
    {
      label: "a raw axios error with no response",
      err: { isAxiosError: true, message: "socket hang up" },
      retryable: true,
    },
    { label: "a 409 fee-policy rejection", err: apiError(409), retryable: false },
    { label: "a 404", err: apiError(404), retryable: false },
    {
      label: "a non-HTTP SymmError",
      err: new SymmError("api", "GASLESS_INSTANCE_MISMATCH", "wrong"),
      retryable: false,
    },
    {
      label: "a raw axios error that carries a response",
      err: { isAxiosError: true, message: "conflict", response: { status: 409 } },
      retryable: false,
    },
    { label: "a plain Error", err: new Error("boom"), retryable: false },
  ])("answers $retryable for $label", ({ err, retryable }) => {
    expect(isRetryableGaslessSubmitError(err)).toBe(retryable);
  });
});

describe("generateGaslessIdempotencyKey", () => {
  it("mints a fresh UUID for every submit", () => {
    const first = generateGaslessIdempotencyKey();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(generateGaslessIdempotencyKey()).not.toBe(first);
  });
});
