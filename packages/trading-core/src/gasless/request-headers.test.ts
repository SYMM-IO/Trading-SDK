import axios, { AxiosError } from "axios";
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readHttpHeader } from "../shared/utils/http-header";
import { isConfirmedGaslessUnavailableError } from "./fallback";
import { gaslessGet, postGaslessSubmit, resolveGaslessHttp } from "./http";
import { resubmitGaslessRequest } from "./resubmit-gasless-request/resubmit-gasless-request";
import { GASLESS_TEST_CHAIN, gaslessTestConfig, TEST_GASLESS } from "./test/config";
import { getGaslessUnconfirmedSubmit } from "./unconfirmed-submit";

const PATH = "/gateway/relay-instant";
const BODY = {
  idempotencyKey: "header-retry",
  userAddress: "0x1111111111111111111111111111111111111111",
  accountId: "0x2222222222222222222222222222222222222222",
  signedOps: [],
  signatures: [],
  walletIds: [],
};

function accepted() {
  return {
    data: { request_id: "request-1", status: "queued" },
    headers: { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("application gasless headers", () => {
  it("preserves the callback through config merging and isolates services and configurations", async () => {
    const first = vi.fn(() => ({ "x-session": "one" }));
    const second = vi.fn(() => ({ "x-session": "two" }));
    const one = gaslessTestConfig({ getRequestHeaders: first }).config;
    const two = gaslessTestConfig({ getRequestHeaders: second }).config;
    const get = vi.spyOn(axios, "get").mockResolvedValue(accepted());
    await Promise.all([
      gaslessGet(resolveGaslessHttp(one, { chainId: GASLESS_TEST_CHAIN, service: "operations" }), "/a", "READ_FAILED"),
      gaslessGet(resolveGaslessHttp(two, { chainId: GASLESS_TEST_CHAIN, service: "deposits" }), "/b", "READ_FAILED"),
    ]);
    expect(first).toHaveBeenCalledWith({ chainId: GASLESS_TEST_CHAIN, service: "operations", method: "GET" });
    expect(second).toHaveBeenCalledWith({ chainId: GASLESS_TEST_CHAIN, service: "deposits", method: "GET" });
    expect(get.mock.calls.map(([, config]) => readHttpHeader(config?.headers, "x-session"))).toEqual(["one", "two"]);
  });

  it("refreshes headers on throttle retries and keeps JSON headers under SDK ownership", async () => {
    vi.useFakeTimers();
    const headers = vi
      .fn()
      .mockResolvedValueOnce({ authorization: "first", accept: "text/plain", "content-type": "text/plain" })
      .mockResolvedValueOnce({ authorization: "second" });
    const config = gaslessTestConfig({ getRequestHeaders: headers }).config;
    const context = resolveGaslessHttp(config, { chainId: GASLESS_TEST_CHAIN, service: "operations" });
    const post = vi
      .spyOn(axios, "post")
      .mockRejectedValueOnce(
        new AxiosError("busy", "429", undefined, undefined, {
          status: 429,
          data: { error: "busy" },
          headers: {},
        } as never),
      )
      .mockResolvedValueOnce(accepted());
    const pending = postGaslessSubmit(context, PATH, BODY, BODY.idempotencyKey);
    await vi.runAllTimersAsync();
    await pending;
    expect(headers).toHaveBeenCalledTimes(2);
    expect(headers).toHaveBeenLastCalledWith({ chainId: GASLESS_TEST_CHAIN, service: "operations", method: "POST" });
    const sent = post.mock.calls.map(([, , options]) => options?.headers);
    expect(sent.map((item) => readHttpHeader(item, "Authorization"))).toEqual(["first", "second"]);
    expect(readHttpHeader(sent[0], "Accept")).toBe("application/json");
    expect(readHttpHeader(sent[0], "Content-Type")).toBe("application/json");
    expect(context.headers.Authorization).toBe("Bearer test-key");
  });

  it("awaits authentication before the POST and resolves fresh credentials for an exact replay", async () => {
    let resolveHeaders!: (value: Record<string, string>) => void;
    const headers = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveHeaders = resolve;
          }),
      )
      .mockResolvedValueOnce({ Authorization: "replay-secret" });
    const config = gaslessTestConfig({ getRequestHeaders: headers }).config;
    const post = vi.spyOn(axios, "post").mockResolvedValue(accepted());
    const pending = postGaslessSubmit(
      resolveGaslessHttp(config, { chainId: GASLESS_TEST_CHAIN, service: "operations" }),
      PATH,
      BODY,
      BODY.idempotencyKey,
    );
    await vi.waitFor(() => expect(headers).toHaveBeenCalledOnce());
    expect(post).not.toHaveBeenCalled();
    resolveHeaders({ Authorization: "first-secret" });
    await pending;
    expect(readHttpHeader(post.mock.calls[0]?.[2]?.headers, "Authorization")).toBe("first-secret");

    await resubmitGaslessRequest(config, {
      chainId: GASLESS_TEST_CHAIN,
      service: "operations",
      path: PATH,
      body: BODY,
      idempotencyKey: BODY.idempotencyKey,
    });
    /** The replay sends the exact body, with credentials resolved for this attempt only. */
    expect(post.mock.calls[1]?.[1]).toEqual(BODY);
    expect(readHttpHeader(post.mock.calls[1]?.[2]?.headers, "Authorization")).toBe("replay-secret");
    expect(JSON.stringify(post.mock.calls.map(([, body]) => body))).not.toMatch(/first-secret|replay-secret/);
  });

  it.each(["GET", "POST"] as const)(
    "sanitizes a failing %s header callback before any HTTP request",
    async (method) => {
      const config = gaslessTestConfig({
        getRequestHeaders: () => {
          throw new Error("credential-secret");
        },
      }).config;
      const context = resolveGaslessHttp(config, { chainId: GASLESS_TEST_CHAIN, service: "operations" });
      const get = vi.spyOn(axios, "get");
      const post = vi.spyOn(axios, "post");
      const failure = await (
        method === "GET"
          ? gaslessGet(context, "/request-1", "READ_FAILED")
          : postGaslessSubmit(context, PATH, BODY, BODY.idempotencyKey)
      ).catch((error: unknown) => error);
      expect(failure).toMatchObject({ code: "GASLESS_REQUEST_HEADERS_FAILED" });
      expect(inspect(failure)).not.toContain("credential-secret");
      expect(get).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      expect(isConfirmedGaslessUnavailableError(failure)).toBe(false);
    },
  );

  it.each([false, true])(
    "retains uncertainty when credentials fail after an earlier submit (replay=%s)",
    async (replay) => {
      vi.useFakeTimers();
      const headers = vi.fn();
      if (!replay) headers.mockResolvedValueOnce({ Authorization: "initial" });
      headers.mockRejectedValue(new Error("expired-secret"));
      const config = gaslessTestConfig({ getRequestHeaders: headers }).config;
      const post = vi.spyOn(axios, "post").mockRejectedValue(new AxiosError("timeout", "ETIMEDOUT"));
      const pending = postGaslessSubmit(
        resolveGaslessHttp(config, { chainId: GASLESS_TEST_CHAIN, service: "operations" }),
        PATH,
        BODY,
        BODY.idempotencyKey,
        { replay },
      ).catch((error: unknown) => error);
      await vi.runAllTimersAsync();
      const failure = await pending;
      expect(failure).toMatchObject({ code: "GASLESS_SUBMIT_UNCONFIRMED" });
      expect(getGaslessUnconfirmedSubmit(failure)?.body).toEqual(BODY);
      expect(post).toHaveBeenCalledTimes(replay ? 0 : 1);
      expect(inspect(failure)).not.toContain("expired-secret");
      expect(isConfirmedGaslessUnavailableError(failure)).toBe(false);
    },
  );
});
