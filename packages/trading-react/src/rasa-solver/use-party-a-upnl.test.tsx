import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getPartyAUpnlQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getPartyAUpnlQueryOptions };
});

import { usePartyAUpnl } from "./use-party-a-upnl";

const USER = "0x1111111111111111111111111111111111111111" as const;

function mockOptions(queryFn: () => Promise<unknown>) {
  getPartyAUpnlQueryOptions.mockReturnValue({
    queryKey: ["getPartyAUpnl", {}],
    enabled: true,
    queryFn,
  });
}

describe("usePartyAUpnl", () => {
  afterEach(() => {
    getPartyAUpnlQueryOptions.mockReset();
  });

  it("wires chainId, solverId, and address into the core query options and returns the uPnL", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue("-12.5"));

    const { result } = renderHookWithProviders(() =>
      usePartyAUpnl({ config, chainId: 8453, solverId: "rasa", address: USER }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe("-12.5");
    expect(getPartyAUpnlQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 8453, solverId: "rasa", address: USER }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue("0"));

    renderHookWithProviders(() => usePartyAUpnl({ config, address: USER }));

    await waitFor(() => expect(getPartyAUpnlQueryOptions).toHaveBeenCalled());
    expect(getPartyAUpnlQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number), address: USER }),
    );
  });
});
