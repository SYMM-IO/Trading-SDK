import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { querySubgraph } from "./query-subgraph";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

describe("querySubgraph", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the document to the chain's analytics endpoint and returns data", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { ok: true } } });
    const result = await querySubgraph<{ ok: boolean }>(config, { document: "query { ok }", variables: {} });

    expect(result).toEqual({ ok: true });
    const [url, body] = post.mock.calls[0]! as [string, { query: string }];
    expect(url).toBe(ANALYTICS_URL);
    expect(body.query).toBe("query { ok }");
  });

  it("throws a SymmApiError carrying the axios error and the Retry-After delay on an HTTP failure", async () => {
    const requestConfig = { url: ANALYTICS_URL, method: "post" } as InternalAxiosRequestConfig;
    const response = {
      status: 429,
      statusText: "Too Many Requests",
      data: { message: "rate limited" },
      headers: { "Retry-After": "7" },
      config: requestConfig,
    } as unknown as AxiosResponse;
    const axiosError = new AxiosError(
      "Request failed with status code 429",
      AxiosError.ERR_BAD_REQUEST,
      requestConfig,
      {},
      response,
    );
    vi.spyOn(axios, "post").mockRejectedValue(axiosError);

    const error = await querySubgraph(config, { document: "query { ok }", variables: {} }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      code: "SUBGRAPH_QUERY_FAILED",
      status: 429,
      url: ANALYTICS_URL,
      method: "POST",
      responseData: { message: "rate limited" },
      retryAfterMs: 7_000,
    });
    expect((error as SymmApiError).cause).toBe(axiosError);
  });

  it("throws a SymmError when the response carries GraphQL errors", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { errors: [{ message: "boom" }] } });
    await expect(querySubgraph(config, { document: "query { ok }", variables: {} })).rejects.toThrow("boom");
  });

  it("throws a SymmError when no endpoint is configured for the subgraph", async () => {
    const unconfigured = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.ARBITRUM]: {
          addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
          subgraphs: { analytics: "" },
        },
      },
    });
    const promise = querySubgraph(unconfigured, { document: "query { ok }", variables: {} });
    await expect(promise).rejects.toBeInstanceOf(SymmError);
    await expect(querySubgraph(unconfigured, { document: "query { ok }", variables: {} })).rejects.toThrow(
      "subgraph endpoint is configured",
    );
  });
});
