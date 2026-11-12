import { TimelockApprovalHttpError } from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig } from "../test/test-utils";
import {
  refreshTimelockInfoAfterUnavailable,
  rememberTimelockCapability,
  timelockCapabilityKey,
} from "./timelock-capability-cache";

describe("known solver timelock capability", () => {
  it("rechecks solver info only after an unavailable approval response, without retrying approval", async () => {
    const { config } = createMockSymmioConfig();
    const client = new QueryClient();
    const options = { url: "https://solver.example", statusText: "Unavailable", retryAfterMs: null };
    const fetch = vi.spyOn(client, "fetchQuery").mockRejectedValue(new Error("still unavailable"));
    await refreshTimelockInfoAfterUnavailable(
      client,
      config,
      42161,
      "enigma",
      new TimelockApprovalHttpError(400, {}, options),
    );
    expect(fetch).not.toHaveBeenCalled();
    await expect(
      refreshTimelockInfoAfterUnavailable(
        client,
        config,
        42161,
        "enigma",
        new TimelockApprovalHttpError(503, {}, options),
      ),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![0].queryKey[0]).toBe("getSolverInfo");
    expect(fetch.mock.calls[0]![0].retry).toBe(false);
    expect(fetch.mock.calls[1]![0].queryKey[0]).toBe("getSolverInfo");
    expect(fetch.mock.calls[1]![0].retry).toBe(false);
  });
  it("retains only positive capability and isolates solver URLs and QueryClients", () => {
    const { config } = createMockSymmioConfig();
    const client = new QueryClient();
    const otherClient = new QueryClient();
    const solver = config.getSolver();
    const key = timelockCapabilityKey(config, 42161);
    const capability = {
      unlocker: "0x2222222222222222222222222222222222222222" as const,
      minTimelockDelaySeconds: 600,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest" as const,
        version: "1" as const,
        chainId: "42161",
        verifyingContract: config.getChainConfig().addresses.accountLayerAddress,
      },
    };
    rememberTimelockCapability(client, key, capability);
    rememberTimelockCapability(client, key, undefined);
    expect(client.getQueryData(key)).toEqual(capability);
    expect(client.getQueryCache().find({ queryKey: key, exact: true })?.gcTime).toBe(Infinity);
    expect(otherClient.getQueryData(key)).toBeUndefined();
    vi.spyOn(config, "getSolver").mockReturnValue({ ...solver, url: `${solver.url}/other` });
    expect(client.getQueryData(timelockCapabilityKey(config, 42161))).toBeUndefined();
    client.clear();
    expect(client.getQueryData(key)).toBeUndefined();
  });
});
