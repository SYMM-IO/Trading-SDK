import axios, { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import { parseGaslessErrorDetail } from "./errors";
import {
  GASLESS_PROTOCOL_INSTANCE_HEADER,
  GASLESS_SUBMIT_THROTTLE_RETRIES,
  GASLESS_SUBMIT_TIMEOUT_MS,
  assertGaslessInstance,
  buildGaslessHttpContext,
  classifyGaslessHttpStatus,
  gaslessGet,
  gaslessSubmitRetryDelay,
  generateGaslessIdempotencyKey,
  isGaslessAcceptedInstanceMismatchError,
  postGaslessSubmit,
  resolveGaslessHttp,
  toGaslessError,
  type GaslessHttpContext,
} from "./http";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "./test/config";
import { getGaslessUnconfirmedSubmit } from "./unconfirmed-submit";

const CHAIN = GASLESS_TEST_CHAIN;
const INSTANCE = TEST_GASLESS.protocolInstance ?? "";
const ANONYMOUS = {
  url: TEST_GASLESS.url,
  protocolInstance: INSTANCE,
  gaslessLayerAddress: TEST_GASLESS.gaslessLayerAddress,
};
const PROXY = { url: "https://app.example/api/gasless", gaslessLayerAddress: TEST_GASLESS.gaslessLayerAddress };
/** A partner key shaped like a real one, so a leak cannot hide behind a common substring. */
const PARTNER_KEY = "gq_live_4f1c9e2b7a6d";

function response(headers: Record<string, string>, data: unknown = {}): AxiosResponse {
  return { headers, data } as unknown as AxiosResponse;
}

function apiError(status: number, responseData?: unknown): SymmApiError {
  return new SymmApiError({
    code: "GASLESS_RELAY_SUBMIT_FAILED",
    message: `HTTP ${status}`,
    status,
    statusText: "",
    responseData,
    url: "https://gasless.test/gateway/relay-instant",
    method: "POST",
  });
}

/**
 * Reject the way axios does: an `AxiosError` whose config is the one the call
 * was made with (headers and serialized body included), whose Node request
 * holds the raw header block, and whose response points back at both.
 */
function rejectLikeAxios(status: number, data: unknown) {
  return async (url: string, body: unknown, requestConfig: { headers: Record<string, string> }) => {
    const config = {
      ...requestConfig,
      url,
      method: "post",
      data: JSON.stringify(body),
      headers: AxiosHeaders.from(requestConfig.headers),
    } as unknown as InternalAxiosRequestConfig;
    const request = {
      _header: `POST ${url} HTTP/1.1\r\nAuthorization: ${requestConfig.headers.Authorization}\r\n\r\n`,
    };
    const failed = { status, statusText: "", data, headers: {}, config, request } as unknown as AxiosResponse;
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      request,
      failed,
    );
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildGaslessHttpContext", () => {
  it("derives the instance-scoped service base from a gateway origin", () => {
    const operations = buildGaslessHttpContext(CHAIN, TEST_GASLESS, "operations");
    const deposits = buildGaslessHttpContext(CHAIN, TEST_GASLESS, "deposits");

    expect(operations.baseURL).toBe(`${TEST_GASLESS.url}/v1/instances/${INSTANCE}/operations`);
    expect(deposits.baseURL).toBe(`${TEST_GASLESS.url}/v1/instances/${INSTANCE}/deposits`);
    expect(operations.protocolInstance).toBe(INSTANCE);
    expect(operations.requireInstanceHeader).toBe(true);
  });

  it("sends no Authorization header at all when no apiKey is configured", () => {
    const context = buildGaslessHttpContext(CHAIN, ANONYMOUS, "operations");

    expect(context.headers).toEqual({ Accept: "application/json" });
  });

  it("omits the header for a blank apiKey rather than sending an empty credential", () => {
    const context = buildGaslessHttpContext(CHAIN, { ...ANONYMOUS, apiKey: "   " }, "operations");

    expect("Authorization" in context.headers).toBe(false);
  });

  it("sends a configured apiKey as a Bearer credential, trimmed", () => {
    expect(buildGaslessHttpContext(CHAIN, TEST_GASLESS, "operations").headers.Authorization).toBe("Bearer test-key");
    expect(
      buildGaslessHttpContext(CHAIN, { ...ANONYMOUS, apiKey: ` ${PARTNER_KEY}\n` }, "operations").headers.Authorization,
    ).toBe(`Bearer ${PARTNER_KEY}`);
  });

  it("appends the service to an instance root and pins its instance", () => {
    const context = buildGaslessHttpContext(
      CHAIN,
      { ...ANONYMOUS, protocolInstance: undefined, url: `${TEST_GASLESS.url}/v1/instances/${INSTANCE}` },
      "operations",
    );

    expect(context.baseURL).toBe(`${TEST_GASLESS.url}/v1/instances/${INSTANCE}/operations`);
    expect(context.protocolInstance).toBe(INSTANCE);
    expect(context.requireInstanceHeader).toBe(true);
  });

  it("uses an instance-pinned service base as-is, for its own service only", () => {
    const url = `${TEST_GASLESS.url}/v1/instances/${INSTANCE}/operations`;

    expect(buildGaslessHttpContext(CHAIN, { ...ANONYMOUS, url }, "operations").baseURL).toBe(url);
    expect(() => buildGaslessHttpContext(CHAIN, { ...ANONYMOUS, url }, "deposits")).toThrow(
      expect.objectContaining({ kind: "config", code: "GASLESS_URL_SERVICE_MISMATCH" }),
    );
  });

  it("treats any other path as a proxy root that checks the instance header only when present", () => {
    const withInstance = buildGaslessHttpContext(CHAIN, { ...PROXY, protocolInstance: INSTANCE }, "deposits");
    const withoutInstance = buildGaslessHttpContext(CHAIN, PROXY, "operations");

    expect(withInstance.baseURL).toBe("https://app.example/api/gasless/deposits");
    expect(withInstance.protocolInstance).toBe(INSTANCE);
    expect(withInstance.requireInstanceHeader).toBe(false);
    expect(withoutInstance.protocolInstance).toBeNull();
  });

  it("rejects the instance-less /v1/{service} compatibility base", () => {
    expect(() =>
      buildGaslessHttpContext(CHAIN, { ...ANONYMOUS, url: `${TEST_GASLESS.url}/v1/operations` }, "operations"),
    ).toThrow(expect.objectContaining({ kind: "config", code: "GASLESS_URL_LEGACY_ROUTE" }));
  });

  it("rejects a url whose path pins a different instance than protocolInstance", () => {
    expect(() =>
      buildGaslessHttpContext(
        CHAIN,
        { ...ANONYMOUS, url: `${TEST_GASLESS.url}/v1/instances/arbitrum-42161-other` },
        "operations",
      ),
    ).toThrow(expect.objectContaining({ kind: "config", code: "GASLESS_PROTOCOL_INSTANCE_CONFLICT" }));
  });

  it("requires protocolInstance for a bare gateway origin", () => {
    expect(() => buildGaslessHttpContext(CHAIN, { ...ANONYMOUS, protocolInstance: undefined }, "operations")).toThrow(
      expect.objectContaining({ kind: "config", code: "GASLESS_PROTOCOL_INSTANCE_REQUIRED" }),
    );
  });

  it("rejects an unparseable url with a typed config error", () => {
    expect(() => buildGaslessHttpContext(CHAIN, { ...TEST_GASLESS, url: "https://[" }, "operations")).toThrow(
      expect.objectContaining({ kind: "config", code: "GASLESS_URL_INVALID" }),
    );
  });

  it("takes the submit timeout from execution.submitTimeoutMs, defaulting to 30 seconds", () => {
    expect(buildGaslessHttpContext(CHAIN, TEST_GASLESS, "operations").submitTimeoutMs).toBe(GASLESS_SUBMIT_TIMEOUT_MS);
    expect(GASLESS_SUBMIT_TIMEOUT_MS).toBe(30_000);
    expect(
      buildGaslessHttpContext(CHAIN, { ...TEST_GASLESS, execution: { submitTimeoutMs: 5_000 } }, "operations")
        .submitTimeoutMs,
    ).toBe(5_000);
  });
});

describe("resolveGaslessHttp", () => {
  it("resolves through the chain's gasless block", () => {
    const { config } = gaslessTestConfig({ execution: { submitTimeoutMs: 12_000 } });

    const context = resolveGaslessHttp(config, { chainId: CHAIN, service: "operations" });

    expect(context.chainId).toBe(CHAIN);
    expect(context.baseURL).toBe(`${TEST_GASLESS.url}/v1/instances/${INSTANCE}/operations`);
    expect(context.submitTimeoutMs).toBe(12_000);
  });
});

describe("assertGaslessInstance", () => {
  const gateway = buildGaslessHttpContext(CHAIN, TEST_GASLESS, "operations");
  const proxy = buildGaslessHttpContext(CHAIN, { ...PROXY, protocolInstance: INSTANCE }, "operations");
  const bareProxy = buildGaslessHttpContext(CHAIN, PROXY, "operations");

  it("accepts a matching header in any casing", () => {
    expect(() =>
      assertGaslessInstance(gateway, response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: INSTANCE })),
    ).not.toThrow();
    expect(() => assertGaslessInstance(gateway, response({ "X-GasLessQ-Protocol-Instance": INSTANCE }))).not.toThrow();
  });

  it("fails closed on a mismatching header", () => {
    expect(() =>
      assertGaslessInstance(gateway, response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: "arbitrum-42161-other" })),
    ).toThrow(expect.objectContaining({ code: "GASLESS_INSTANCE_MISMATCH" }));
  });

  it("fails closed on a missing header for a gateway url", () => {
    expect(() => assertGaslessInstance(gateway, response({}))).toThrow(
      expect.objectContaining({ code: "GASLESS_INSTANCE_MISMATCH" }),
    );
  });

  it("lets a proxy root through when the proxy does not forward the header", () => {
    expect(() => assertGaslessInstance(proxy, response({}))).not.toThrow();
  });

  it("still fails a proxy root whose forwarded header names another instance", () => {
    expect(() =>
      assertGaslessInstance(proxy, response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: "arbitrum-42161-other" })),
    ).toThrow(expect.objectContaining({ code: "GASLESS_INSTANCE_MISMATCH" }));
    expect(() =>
      assertGaslessInstance(proxy, response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: INSTANCE })),
    ).not.toThrow();
  });

  it("skips the check for a proxy root that names no instance", () => {
    expect(() =>
      assertGaslessInstance(bareProxy, response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: "arbitrum-42161-other" })),
    ).not.toThrow();
  });
});

describe("gaslessGet / postGaslessSubmit", () => {
  const anonymous = buildGaslessHttpContext(CHAIN, ANONYMOUS, "operations");

  it("posts with the submit timeout, the JSON content type and no credential when anonymous", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue(response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: INSTANCE }, { request_id: "req-1" }));

    await expect(postGaslessSubmit(anonymous, "/gateway/relay-instant", { a: 1 }, "key-1")).resolves.toEqual({
      request_id: "req-1",
    });
    expect(post).toHaveBeenCalledWith(
      "/gateway/relay-instant",
      { a: 1 },
      {
        baseURL: anonymous.baseURL,
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        timeout: 30_000,
      },
    );
  });

  it("honors a configured submit timeout", async () => {
    const context = buildGaslessHttpContext(
      CHAIN,
      { ...TEST_GASLESS, execution: { submitTimeoutMs: 7_500 } },
      "deposits",
    );
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValue(response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: INSTANCE }, { request_id: "req-1" }));

    await postGaslessSubmit(context, "/deposit-settlements/new-account", {}, "key-1");

    expect(post.mock.calls[0]?.[2]).toMatchObject({ timeout: 7_500, headers: { Authorization: "Bearer test-key" } });
  });

  it("does not bound status reads by the submit timeout", async () => {
    const get = vi
      .spyOn(axios, "get")
      .mockResolvedValue(response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: INSTANCE }, {}));

    await gaslessGet(anonymous, "/req-1", "GASLESS_STATUS_FETCH_FAILED");

    expect(get.mock.calls[0]?.[1]).not.toHaveProperty("timeout");
  });

  it("retries a submit timeout once with the same body, then reports it unconfirmed", async () => {
    const post = vi.spyOn(axios, "post").mockRejectedValue(
      new AxiosError("timeout of 30000ms exceeded", AxiosError.ECONNABORTED, {
        url: "/gateway/relay-instant",
        method: "post",
      } as InternalAxiosRequestConfig),
    );
    const body = { idempotencyKey: "key-1", signatures: ["0xdeadbeef"] };

    const error = await postGaslessSubmit(anonymous, "/gateway/relay-instant", body, "key-1").catch(
      (err: unknown) => err,
    );

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[1]).toBe(body);
    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({ code: "GASLESS_SUBMIT_UNCONFIRMED", status: 0 });
    expect(getGaslessUnconfirmedSubmit(error)).toEqual({
      chainId: CHAIN,
      service: "operations",
      path: "/gateway/relay-instant",
      body,
      idempotencyKey: "key-1",
    });
    expect((error as SymmApiError).cause).toMatchObject({ code: "GASLESS_RELAY_SUBMIT_FAILED", status: 0 });
  });

  it("reads through a proxy root that strips the instance header, and rejects one that names another instance", async () => {
    const proxy = buildGaslessHttpContext(CHAIN, { ...PROXY, protocolInstance: INSTANCE }, "operations");
    const get = vi.spyOn(axios, "get").mockResolvedValueOnce(response({}, { id: "req-1" }));

    await expect(gaslessGet(proxy, "/req-1", "GASLESS_STATUS_FETCH_FAILED")).resolves.toEqual({ id: "req-1" });

    get.mockResolvedValueOnce(response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: "arbitrum-42161-other" }, {}));
    await expect(gaslessGet(proxy, "/req-1", "GASLESS_STATUS_FETCH_FAILED")).rejects.toMatchObject({
      code: "GASLESS_INSTANCE_MISMATCH",
    });
  });

  it("never leaks the apiKey or the signed body through a thrown error", async () => {
    const context: GaslessHttpContext = buildGaslessHttpContext(
      CHAIN,
      { ...TEST_GASLESS, apiKey: PARTNER_KEY },
      "operations",
    );
    const signedBody = {
      signatures: ["0xsigned-by-the-user"],
      userAddress: "0x1111111111111111111111111111111111111111",
    };
    const reject = rejectLikeAxios(401, { error: "Invalid API key" });
    /** Control: the axios rejection itself does carry the key, so the assertions below are meaningful. */
    const raw = await reject("/gateway/relay-instant", signedBody, { headers: context.headers }).catch(
      (err: unknown) => err,
    );
    expect(inspect(raw, { depth: Infinity })).toContain(PARTNER_KEY);
    vi.spyOn(axios, "post").mockImplementation(reject as typeof axios.post);

    const error = await postGaslessSubmit(context, "/gateway/relay-instant", signedBody, "key-1").catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({ status: 401 });
    for (const rendered of [
      JSON.stringify(error),
      inspect(error, { depth: Infinity, showHidden: true }),
      String((error as Error).stack),
    ]) {
      expect(rendered).not.toContain(PARTNER_KEY);
      expect(rendered).not.toContain("0xsigned-by-the-user");
    }
  });
});

describe("toGaslessError", () => {
  const context = buildGaslessHttpContext(CHAIN, TEST_GASLESS, "operations");

  it("passes an SDK error through untouched", () => {
    const err = new SymmError("api", "GASLESS_INSTANCE_MISMATCH", "wrong instance");

    expect(toGaslessError(err, context, "GASLESS_RELAY_SUBMIT_FAILED")).toBe(err);
  });

  it("normalizes an axios error into a SymmApiError under the call's code, with a sanitized cause", () => {
    const vendorBody = { detail: { code: "FEE_POLICY_WOULD_REVERT" } };
    const axiosLike = {
      isAxiosError: true,
      message: "conflict",
      response: { status: 409, statusText: "Conflict", data: vendorBody, headers: { "retry-after": "2" } },
      config: { url: "/gateway/relay-instant", method: "post", headers: { Authorization: "Bearer test-key" } },
    };

    const normalized = toGaslessError(axiosLike, context, "GASLESS_RELAY_SUBMIT_FAILED");

    expect(normalized).toBeInstanceOf(SymmApiError);
    expect(normalized).toMatchObject({
      code: "GASLESS_RELAY_SUBMIT_FAILED",
      status: 409,
      responseData: vendorBody,
      url: `${context.baseURL}/gateway/relay-instant`,
      method: "POST",
      retryAfterMs: 2_000,
    });
    expect(normalized.cause).not.toBe(axiosLike);
    expect(normalized.cause).toMatchObject({ name: "AxiosError", message: "conflict", status: 409 });
    expect((normalized.cause as unknown as Record<string, unknown>).config).toBeUndefined();
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

  it("keeps the gateway { error } envelope and the 422 detail array readable", () => {
    const envelope = toGaslessError(
      {
        isAxiosError: true,
        message: "Request failed with status code 404",
        response: { status: 404, statusText: "Not Found", data: { error: "Unknown or disabled protocol instance: x" } },
        config: { url: "/health", method: "get" },
      },
      context,
      "GASLESS_STATUS_FETCH_FAILED",
    );
    const schema = toGaslessError(
      {
        isAxiosError: true,
        message: "Request failed with status code 422",
        response: {
          status: 422,
          statusText: "Unprocessable Entity",
          data: {
            detail: [{ type: "uuid_parsing", loc: ["path", "request_id"], msg: "Input should be a valid UUID" }],
          },
        },
        config: { url: "/not-a-uuid", method: "get" },
      },
      context,
      "GASLESS_STATUS_FETCH_FAILED",
    );

    expect(parseGaslessErrorDetail(envelope)?.gatewayError).toBe("Unknown or disabled protocol instance: x");
    expect(classifyGaslessHttpStatus(envelope)).toBe("unknown-instance");
    expect(parseGaslessErrorDetail(schema)?.validationErrors).toEqual([
      { loc: ["path", "request_id"], msg: "Input should be a valid UUID", type: "uuid_parsing" },
    ]);
    expect(classifyGaslessHttpStatus(schema)).toBe("client-schema");
  });
});

describe("classifyGaslessHttpStatus", () => {
  const GATEWAY = { error: "gateway says no" };
  const SERVICE = { detail: { code: "NOT_FOUND", message: "operation request not found" } };

  it.each([
    { label: "a network failure or timeout", err: apiError(0), expected: "ambiguous" },
    { label: "a 408", err: apiError(408), expected: "ambiguous" },
    { label: "a 500", err: apiError(500), expected: "ambiguous" },
    { label: "a 502", err: apiError(502, "error code: 502"), expected: "ambiguous" },
    { label: "a 504", err: apiError(504), expected: "ambiguous" },
    { label: "a 503 without the gateway envelope", err: apiError(503), expected: "ambiguous" },
    { label: "a 503 with the gateway envelope", err: apiError(503, GATEWAY), expected: "gateway-not-ready" },
    { label: "a 429", err: apiError(429, { error: "Rate limit exceeded" }), expected: "rate-limited" },
    { label: "a 401", err: apiError(401, GATEWAY), expected: "unauthorized" },
    { label: "a 403", err: apiError(403, GATEWAY), expected: "forbidden" },
    { label: "a 404 with the gateway envelope", err: apiError(404, GATEWAY), expected: "unknown-instance" },
    { label: "a 404 from the service", err: apiError(404, SERVICE), expected: "service" },
    { label: "a 400 with the gateway envelope", err: apiError(400, GATEWAY), expected: "selector-conflict" },
    {
      label: "a 400 from the service",
      err: apiError(400, { detail: { code: "SIMULATION_REVERTED" } }),
      expected: "service",
    },
    { label: "a 409", err: apiError(409, { detail: { code: "IDEMPOTENCY_KEY_CONFLICT" } }), expected: "service" },
    { label: "a 422", err: apiError(422, { detail: [] }), expected: "client-schema" },
  ])("classifies $label as $expected", ({ err, expected }) => {
    expect(classifyGaslessHttpStatus(err)).toBe(expected);
  });

  it("returns null for anything that is not an HTTP failure", () => {
    expect(classifyGaslessHttpStatus(new SymmError("config", "GASLESS_URL_INVALID", "bad"))).toBeNull();
    expect(classifyGaslessHttpStatus(new Error("boom"))).toBeNull();
  });
});

describe("generateGaslessIdempotencyKey", () => {
  it("mints a fresh UUID for every submit", () => {
    const first = generateGaslessIdempotencyKey();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(generateGaslessIdempotencyKey()).not.toBe(first);
  });
});

describe("gaslessSubmitRetryDelay", () => {
  it("never waits less than a jittered second, whatever the server said", () => {
    expect(gaslessSubmitRetryDelay(null, () => 0)).toBe(1_000);
    expect(gaslessSubmitRetryDelay(0, () => 0.5)).toBe(1_500);
    expect(gaslessSubmitRetryDelay(250, () => 0)).toBe(1_000);
  });

  it("honors a longer Retry-After", () => {
    expect(gaslessSubmitRetryDelay(9_000, () => 0.999)).toBe(9_000);
  });
});

describe("postGaslessSubmit retries", () => {
  const anonymous = buildGaslessHttpContext(CHAIN, ANONYMOUS, "operations");
  const accepted = () => response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: INSTANCE }, { request_id: "req-1" });

  /** `rejectLikeAxios` builds the shape `toGaslessError` normalizes, headers included. */
  function rejectWith(status: number, data: unknown, headers: Record<string, string> = {}) {
    return async (url: string, body: unknown, requestConfig: { headers: Record<string, string> }) => {
      const config = {
        url,
        method: "post",
        headers: AxiosHeaders.from(requestConfig.headers),
      } as InternalAxiosRequestConfig;
      const failed = { status, statusText: "", data, headers, config } as unknown as AxiosResponse;
      throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, {}, failed);
    };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resends a 429 under the same key after the Retry-After delay, and succeeds", async () => {
    vi.useFakeTimers();
    const post = vi
      .spyOn(axios, "post")
      .mockImplementationOnce(
        rejectWith(429, { error: "Rate limit exceeded" }, { "retry-after": "3" }) as typeof axios.post,
      )
      .mockResolvedValueOnce(accepted());
    const body = { idempotencyKey: "key-1" };

    const pending = postGaslessSubmit(anonymous, "/gateway/relay-instant", body, "key-1");
    await vi.advanceTimersByTimeAsync(2_999);
    expect(post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toEqual({ request_id: "req-1" });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]?.[1]).toBe(body);
  });

  it("gives up after two throttle retries and throws the gateway's own answer, which stays fallback-eligible", async () => {
    vi.useFakeTimers();
    const post = vi
      .spyOn(axios, "post")
      .mockImplementation(rejectWith(503, { error: "Gateway configuration not ready" }) as typeof axios.post);

    const pending = postGaslessSubmit(anonymous, "/gateway/relay-instant", {}, "key-1").catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await pending;

    expect(post).toHaveBeenCalledTimes(GASLESS_SUBMIT_THROTTLE_RETRIES + 1);
    expect(error).toMatchObject({ code: "GASLESS_RELAY_SUBMIT_FAILED", status: 503 });
    expect(getGaslessUnconfirmedSubmit(error)).toBeNull();
    expect(classifyGaslessHttpStatus(error)).toBe("gateway-not-ready");
  });

  it("does not start a throttle retry that would outlive the submit timeout", async () => {
    vi.useFakeTimers();
    const context = buildGaslessHttpContext(CHAIN, { ...ANONYMOUS, execution: { submitTimeoutMs: 500 } }, "operations");
    const post = vi
      .spyOn(axios, "post")
      .mockImplementation(rejectWith(429, { error: "Rate limit exceeded" }) as typeof axios.post);

    const error = await postGaslessSubmit(context, "/gateway/relay-instant", {}, "key-1").catch((err: unknown) => err);

    expect(post).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 429 });
  });

  it("treats a 5xx without the gateway envelope as ambiguous, never as unavailable", async () => {
    const post = vi.spyOn(axios, "post").mockImplementation(rejectWith(502, "error code: 502") as typeof axios.post);

    const error = await postGaslessSubmit(anonymous, "/gateway/relay-instant", {}, "key-1").catch(
      (err: unknown) => err,
    );

    expect(post).toHaveBeenCalledTimes(2);
    expect(error).toMatchObject({ code: "GASLESS_SUBMIT_UNCONFIRMED", status: 502 });
    expect(getGaslessUnconfirmedSubmit(error)?.idempotencyKey).toBe("key-1");
  });

  it("stops at a definitive 4xx without resending anything", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockImplementation(rejectWith(400, { detail: { code: "SIMULATION_REVERTED" } }) as typeof axios.post);

    const error = await postGaslessSubmit(anonymous, "/gateway/relay-instant", {}, "key-1").catch(
      (err: unknown) => err,
    );

    expect(post).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ code: "GASLESS_RELAY_SUBMIT_FAILED", status: 400 });
  });

  it("reports a 2xx without a request_id as unconfirmed rather than as an acceptance", async () => {
    vi.spyOn(axios, "post").mockResolvedValue(
      response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: INSTANCE }, { status: "queued" }),
    );

    const error = await postGaslessSubmit(anonymous, "/gateway/relay-instant", {}, "key-1").catch(
      (err: unknown) => err,
    );

    expect(error).toMatchObject({ code: "GASLESS_SUBMIT_UNCONFIRMED" });
    expect(getGaslessUnconfirmedSubmit(error)).toMatchObject({ idempotencyKey: "key-1", service: "operations" });
  });

  it("keeps the accepted request_id when a 2xx came from another protocol instance", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      ...response({ [GASLESS_PROTOCOL_INSTANCE_HEADER]: "arbitrum-42161-other" }, { request_id: "req-1" }),
      status: 202,
      statusText: "Accepted",
    } as AxiosResponse);

    const error = await postGaslessSubmit(anonymous, "/gateway/relay-instant", {}, "key-1").catch(
      (err: unknown) => err,
    );

    expect(error).toMatchObject({ code: "GASLESS_INSTANCE_MISMATCH", status: 202 });
    expect((error as SymmApiError).responseData).toEqual({ request_id: "req-1" });
    expect(isGaslessAcceptedInstanceMismatchError(error)).toBe(true);
    expect(getGaslessUnconfirmedSubmit(error)).toBeNull();
  });
});
