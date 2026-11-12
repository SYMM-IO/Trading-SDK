import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig } from "../test/test-utils";

const query = vi.hoisted(() => vi.fn());
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getSolverInfoQueryOptions: (_config: unknown, options: { solverId?: string }) => ({
      queryKey: ["health-test", options.solverId ?? "default"],
      queryFn: query,
    }),
  };
});

import { SymmError, TimelockApprovalHttpError } from "@symmio/trading-core";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { refreshTimelockInfoAfterUnavailable } from "./timelock-capability-cache";

describe("solver health refresh", () => {
  it("shares one request and normalizes errors for default and explicit solver observers", async () => {
    const { config } = createMockSymmioConfig();
    const client = new QueryClient();
    query.mockReset().mockRejectedValue(new SymmError("api", "INFO_UNAVAILABLE", "offline"));
    const failure = new TimelockApprovalHttpError(
      503,
      {},
      { url: "https://solver.example", statusText: "Unavailable", retryAfterMs: null },
    );
    await refreshTimelockInfoAfterUnavailable(client, config, 42161, "enigma", failure);
    expect(query).toHaveBeenCalledOnce();
    expect(client.getQueryState(["health-test", "enigma"])?.error).toBeInstanceOf(SymmioRequestError);
    expect(client.getQueryState(["health-test", "default"])?.error).toBeInstanceOf(SymmioRequestError);
  });
  it("performs a fresh read on a later explicit refresh", async () => {
    const { config } = createMockSymmioConfig();
    const client = new QueryClient();
    query.mockReset().mockResolvedValue({});
    const failure = new TimelockApprovalHttpError(
      503,
      {},
      {
        url: "https://solver.example",
        statusText: "Unavailable",
        retryAfterMs: null,
      },
    );
    await refreshTimelockInfoAfterUnavailable(client, config, 42161, "enigma", failure);
    expect(query).toHaveBeenCalledTimes(1);
    await client.refetchQueries({ queryKey: ["health-test"], type: "all" });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
