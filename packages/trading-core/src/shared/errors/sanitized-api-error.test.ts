import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { toSanitizedApiError } from "./sanitized-api-error";
import { SymmApiError } from "./symm-error";

const BASE_URL = "https://gateway.test";
const PARTNER_KEY = "gq_live_9f8e7d6c5b4a";
const BODY_SECRET = "0xsigned-payload-not-for-logs";

/**
 * An axios error shaped like a real adapter rejection: the request config holds
 * the bearer header and the body, the Node `ClientRequest` holds the raw header
 * block, and the response points back at both.
 */
function authedAxiosError(options: { url?: string; responseHeaders?: AxiosHeaders | Record<string, string> } = {}) {
  const config = {
    url: options.url ?? "/gateway/relay-instant",
    method: "post",
    headers: AxiosHeaders.from({ Authorization: `Bearer ${PARTNER_KEY}`, "Content-Type": "application/json" }),
    data: JSON.stringify({ signatures: [BODY_SECRET] }),
  } as unknown as InternalAxiosRequestConfig;
  const request = { _header: `POST /gateway/relay-instant HTTP/1.1\r\nAuthorization: Bearer ${PARTNER_KEY}\r\n\r\n` };
  const response = {
    status: 429,
    statusText: "Too Many Requests",
    data: { error: "Rate limit exceeded" },
    headers: options.responseHeaders ?? {},
    config,
    request,
  } as unknown as AxiosResponse;
  return new AxiosError("Request failed with status code 429", AxiosError.ERR_BAD_REQUEST, config, request, response);
}

describe("toSanitizedApiError", () => {
  it("keeps every field fromAxios derives", () => {
    const axiosError = authedAxiosError({ responseHeaders: { "retry-after": "2" } });

    const error = toSanitizedApiError(axiosError, { code: "GASLESS_RELAY_SUBMIT_FAILED", baseURL: BASE_URL });

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "GASLESS_RELAY_SUBMIT_FAILED",
      status: 429,
      statusText: "Too Many Requests",
      url: `${BASE_URL}/gateway/relay-instant`,
      method: "POST",
      responseData: { error: "Rate limit exceeded" },
      retryAfterMs: 2_000,
    });
    expect(error.message).toBe(
      SymmApiError.fromAxios(axiosError, { code: "GASLESS_RELAY_SUBMIT_FAILED", baseURL: BASE_URL }).message,
    );
  });

  it("replaces the axios error with a sanitized cause", () => {
    const axiosError = authedAxiosError();

    const error = toSanitizedApiError(axiosError, { code: "X_FAILED", baseURL: BASE_URL });

    expect(error.cause).toBeInstanceOf(Error);
    expect(error.cause).not.toBe(axiosError);
    expect(error.cause).toMatchObject({
      name: "AxiosError",
      message: "Request failed with status code 429",
      code: "ERR_BAD_REQUEST",
      status: 429,
      method: "POST",
      url: `${BASE_URL}/gateway/relay-instant`,
    });
    const cause = error.cause as unknown as Record<string, unknown>;
    expect(cause.config).toBeUndefined();
    expect(cause.request).toBeUndefined();
    expect(cause.response).toBeUndefined();
  });

  it("keeps the no-response shape: status 0, no retry delay, the transport code on the cause", () => {
    const error = toSanitizedApiError(new AxiosError("timeout of 30000ms exceeded", AxiosError.ECONNABORTED), {
      code: "X_FAILED",
      baseURL: BASE_URL,
    });

    expect(error).toMatchObject({ status: 0, retryAfterMs: null, url: BASE_URL });
    expect(error.cause).toMatchObject({ name: "AxiosError", code: "ECONNABORTED", status: 0, url: BASE_URL });
  });

  it("strips userinfo, query string and fragment from the url, the message and the cause", () => {
    const error = toSanitizedApiError(authedAxiosError({ url: "/gateway/relay-instant?token=abc#top" }), {
      code: "X_FAILED",
      baseURL: `https://partner:${PARTNER_KEY}@gateway.test`,
    });

    expect(error.url).toBe(`${BASE_URL}/gateway/relay-instant`);
    expect(error.message).toBe(
      `X_FAILED: Request failed with status code 429 (POST ${BASE_URL}/gateway/relay-instant → 429 Too Many Requests)`,
    );
    expect((error.cause as unknown as { url: string }).url).toBe(`${BASE_URL}/gateway/relay-instant`);
  });

  it("never exposes the request credentials or body through serialization or inspection", () => {
    const axiosError = authedAxiosError({ url: "/gateway/relay-instant?token=abc" });
    /** Control: the raw axios error does leak them, so the assertions below are meaningful. */
    expect(inspect(axiosError, { depth: Infinity })).toContain(PARTNER_KEY);
    expect(inspect(axiosError, { depth: Infinity })).toContain(BODY_SECRET);

    const error = toSanitizedApiError(axiosError, {
      code: "X_FAILED",
      baseURL: `https://partner:${PARTNER_KEY}@gateway.test`,
    });

    for (const rendered of [
      JSON.stringify(error),
      JSON.stringify(error.cause),
      inspect(error, { depth: Infinity, showHidden: true }),
      String(error.stack),
    ]) {
      expect(rendered).not.toContain(PARTNER_KEY);
      expect(rendered).not.toContain(BODY_SECRET);
    }
  });
});
