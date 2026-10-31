import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useAddMargin } from "./use-add-margin";

const stubs = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@symmio/trading-core", async (original) => ({
  ...(await original<typeof import("@symmio/trading-core")>()),
  addMarginMutationOptions: () => ({ mutationKey: ["addMargin"], mutationFn: stubs.mutate }),
}));

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const UNLOCKER = "0x2222222222222222222222222222222222222222" as const;

describe("automatic add-margin protection", () => {
  it("injects solver authorization when the selector is locked", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    const capability = {
      unlocker: UNLOCKER,
      minTimelockDelaySeconds: 300,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig(42161).addresses.accountLayerAddress,
      },
    };
    vi.spyOn(queryClient, "fetchQuery")
      .mockResolvedValueOnce({ timelockApproval: capability } as never)
      .mockResolvedValueOnce({ rootAccount: ACCOUNT, ready: true, selectors: [{ status: "ok" }] } as never);
    const getClient = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...getClient(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    stubs.mutate.mockReset().mockResolvedValue(TEST_TX_HASH);
    const { result } = renderHookWithProviders(() => useAddMargin({ config, waitForReceipt: false }), { queryClient });
    await result.current.mutateAsync({ virtualAccount: ACCOUNT, amount: 1n });
    expect(stubs.mutate).toHaveBeenCalledOnce();
    expect(stubs.mutate.mock.calls[0]?.[0]).toMatchObject({
      virtualAccount: ACCOUNT,
      amount: 1n,
      timelock: { capability, deadline: 1300n },
    });
  });
});
