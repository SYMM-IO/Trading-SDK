import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatApiErrorMessage, SymmApiError, SymmError } from "./symm-error";

const BASE_URL = "https://listing.test";

/** An axios error shaped like a real adapter rejection of `POST /v2/withdraw`. */
function rateLimitedAxiosError(responseHeaders: AxiosHeaders | Record<string, string> = {}) {
  const config = {
    url: "/v2/withdraw",
    method: "post",
    headers: AxiosHeaders.from({ "Content-Type": "application/json" }),
  } as unknown as InternalAxiosRequestConfig;
  const response = {
    status: 429,
    statusText: "Too Many Requests",
    data: { error: "Rate limit exceeded" },
    headers: responseHeaders,
    config,
  } as unknown as AxiosResponse;
  return new AxiosError("Request failed with status code 429", AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("SymmApiError", () => {
  it("defaults retryAfterMs to null when constructed directly", () => {
    const error = new SymmApiError({
      code: "X_FAILED",
      message: "failed",
      status: 500,
      statusText: "",
      url: BASE_URL,
      method: "GET",
    });

    expect(error.retryAfterMs).toBeNull();
    expect(error).toBeInstanceOf(SymmError);
  });
});

describe("SymmApiError.fromAxios", () => {
  it("carries the request coordinates, response body and composed message", () => {
    const error = SymmApiError.fromAxios(rateLimitedAxiosError(), { code: "WITHDRAW_LP_FAILED", baseURL: BASE_URL });

    expect(error).toMatchObject({
      kind: "api",
      code: "WITHDRAW_LP_FAILED",
      status: 429,
      statusText: "Too Many Requests",
      url: `${BASE_URL}/v2/withdraw`,
      method: "POST",
      responseData: { error: "Rate limit exceeded" },
    });
    expect(error.message).toBe(
      `WITHDRAW_LP_FAILED: Request failed with status code 429 (POST ${BASE_URL}/v2/withdraw → 429 Too Many Requests)`,
    );
  });

  it("keeps the original axios error as cause", () => {
    const axiosError = rateLimitedAxiosError();

    expect(SymmApiError.fromAxios(axiosError, { code: "X_FAILED", baseURL: BASE_URL }).cause).toBe(axiosError);
  });

  it("parses Retry-After delay-seconds from a plain header object", () => {
    const error = SymmApiError.fromAxios(rateLimitedAxiosError({ "retry-after": "3" }), {
      code: "X_FAILED",
      baseURL: BASE_URL,
    });

    expect(error.retryAfterMs).toBe(3_000);
  });

  it("parses a Retry-After HTTP-date from AxiosHeaders, whatever its casing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T12:00:00Z"));

    const error = SymmApiError.fromAxios(
      rateLimitedAxiosError(AxiosHeaders.from("Retry-After: Thu, 17 Sep 2026 12:00:05 GMT")),
      { code: "X_FAILED", baseURL: BASE_URL },
    );

    expect(error.retryAfterMs).toBe(5_000);
  });

  it("reports no retry delay and status 0 when the failure has no response", () => {
    const axiosError = new AxiosError("timeout of 30000ms exceeded", AxiosError.ECONNABORTED);

    const error = SymmApiError.fromAxios(axiosError, { code: "X_FAILED", baseURL: BASE_URL });

    expect(error).toMatchObject({ status: 0, statusText: "Unknown", url: BASE_URL, method: "GET" });
    expect(error.retryAfterMs).toBeNull();
    expect(error.cause).toBe(axiosError);
  });
});

describe("formatApiErrorMessage", () => {
  it("puts the code, the transport message and the request coordinates on one line", () => {
    expect(
      formatApiErrorMessage({
        code: "X_FAILED",
        message: "Network Error",
        method: "GET",
        url: `${BASE_URL}/health`,
        status: 0,
        statusText: "Unknown",
      }),
    ).toBe(`X_FAILED: Network Error (GET ${BASE_URL}/health → 0 Unknown)`);
  });
});
