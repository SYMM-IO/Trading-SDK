import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import {
  createExpressConfig,
  createExpressOptionWire,
  TEST_ACCOUNT,
  TEST_AFFILIATE,
  TEST_AMOUNT,
  TEST_RECEIVER,
} from "../test-fixtures";
import { getExpressWithdrawOptions } from "./get-express-withdraw-options";
import { getExpressWithdrawOptionsQueryOptions } from "./query";

describe("getExpressWithdrawOptions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts the exact intent, defaults affiliate, normalizes values, and drops expired offers", async () => {
    const valid = createExpressOptionWire();
    const expired = createExpressOptionWire({ deadline: 1 });
    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { options: [valid, expired], requestDbId: 42, requestDbIds: { SAME_TX: 42 } },
    });
    const signal = new AbortController().signal;
    const config = createExpressConfig();

    const result = await getExpressWithdrawOptions(config, {
      user: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      signal,
    });

    expect(post).toHaveBeenCalledWith(
      "/options",
      { user: TEST_ACCOUNT, amount: "1000000", receiver: TEST_RECEIVER, affiliate: TEST_AFFILIATE },
      {
        baseURL: "https://express.test/v1/",
        signal,
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(result.options).toHaveLength(1);
    expect(result.options[0]?.expressAmount).toBe(TEST_AMOUNT);
  });

  it("forwards an affiliate override and wraps HTTP response context", async () => {
    const requestConfig = { url: "/options", method: "post", headers: {} } as InternalAxiosRequestConfig;
    const response = {
      status: 503,
      statusText: "Service Unavailable",
      data: { detail: "down" },
      headers: {},
      config: requestConfig,
    } as AxiosResponse;
    vi.spyOn(axios, "post").mockRejectedValue(
      new AxiosError("Request failed", AxiosError.ERR_BAD_RESPONSE, requestConfig, {}, response),
    );

    const rejection = (await getExpressWithdrawOptions(createExpressConfig(), {
      user: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      affiliate: TEST_RECEIVER,
    }).catch((error: unknown) => error)) as SymmApiError;

    expect(rejection).toBeInstanceOf(SymmApiError);
    expect(rejection).toMatchObject({
      code: "GET_EXPRESS_WITHDRAW_OPTIONS_FAILED",
      status: 503,
      method: "POST",
      responseData: { detail: "down" },
    });
  });

  it("builds a non-retrying, immediately stale query and excludes control fields from its key", () => {
    const signal = new AbortController().signal;
    const options = getExpressWithdrawOptionsQueryOptions(createExpressConfig(), {
      user: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      signal,
      query: { retry: 3 },
    });

    expect(options.staleTime).toBe(0);
    expect(options.gcTime).toBe(0);
    expect(options.retry).toBe(false);
    expect(options.queryKey[1]).not.toHaveProperty("signal");
    expect(options.queryKey[1]).not.toHaveProperty("query");
  });
});
