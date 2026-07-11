import axios from "axios";
import type { PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { querySubgraph } from "./query-subgraph";

const ANALYTICS_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).subgraphs.analytics;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
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

  it("throws a SymmError when the response carries GraphQL errors", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { errors: [{ message: "boom" }] } });
    await expect(querySubgraph(config, { document: "query { ok }", variables: {} })).rejects.toThrow("boom");
  });

  it("throws a SymmError when no endpoint is configured for the subgraph", async () => {
    const unconfigured = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
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
