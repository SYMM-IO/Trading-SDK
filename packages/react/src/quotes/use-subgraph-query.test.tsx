import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const querySubgraphQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@theoldvarorg/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@theoldvarorg/core")>();
  return { ...actual, querySubgraphQueryOptions };
});

import { useSubgraphQuery } from "./use-subgraph-query";

describe("useSubgraphQuery", () => {
  afterEach(() => {
    querySubgraphQueryOptions.mockReset();
  });

  it("wires the document + connected chain into the core options and returns typed data", async () => {
    const { config } = createMockSymmioConfig();
    querySubgraphQueryOptions.mockReturnValue({
      queryKey: ["querySubgraph", {}],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue({ ok: true }),
    });

    const { result } = renderHookWithProviders(() =>
      useSubgraphQuery<{ ok: boolean }>({ document: "query { ok }", variables: {}, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ ok: true });
    expect(querySubgraphQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ document: "query { ok }", chainId: expect.any(Number) }),
    );
  });

  it("normalizes a failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    querySubgraphQueryOptions.mockReturnValue({
      queryKey: ["querySubgraph", {}],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const { result } = renderHookWithProviders(() =>
      useSubgraphQuery({ document: "query { ok }", variables: {}, config }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
