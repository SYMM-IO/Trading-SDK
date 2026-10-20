import { SubAccountIsolationType, type WithdrawRouteChoices } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getWithdrawRouteChoicesQueryOptions = vi.hoisted(() => vi.fn());
const useSubAccount = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@symmio/trading-core")>()),
  getWithdrawRouteChoicesQueryOptions,
}));
vi.mock("../account-layer/use-sub-account", () => ({ useSubAccount }));

import { useWithdrawRouteChoices } from "./use-withdraw-route-choices";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const RECEIVER = "0x2222222222222222222222222222222222222222" as const;
const CHOICES: WithdrawRouteChoices = {
  recommended: { kind: "classic", finalize: "after-cooldown", reason: "no-option" },
  available: [{ kind: "classic", finalize: "after-cooldown" }],
};

describe("useWithdrawRouteChoices", () => {
  afterEach(() => {
    getWithdrawRouteChoicesQueryOptions.mockReset();
    useSubAccount.mockReset();
  });

  it("forwards resolved isolation and returns the prepared choices", async () => {
    const { config } = createMockSymmioConfig();
    useSubAccount.mockReturnValue({ data: { isolationType: SubAccountIsolationType.MARKET } });
    getWithdrawRouteChoicesQueryOptions.mockReturnValue({
      queryKey: ["getWithdrawRouteChoices", {}],
      enabled: true,
      queryFn: vi.fn().mockResolvedValue(CHOICES),
    });

    const { result } = renderHookWithProviders(() =>
      useWithdrawRouteChoices({ config, user: ACCOUNT, amount: 1_000_000n, receiver: RECEIVER }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(CHOICES);
    expect(getWithdrawRouteChoicesQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        user: ACCOUNT,
        amount: 1_000_000n,
        receiver: RECEIVER,
        chainId: expect.any(Number),
        isolationType: SubAccountIsolationType.MARKET,
      }),
    );
  });

  it("normalizes route-discovery failures", async () => {
    const { config } = createMockSymmioConfig();
    useSubAccount.mockReturnValue({ data: { isolationType: SubAccountIsolationType.MARKET } });
    getWithdrawRouteChoicesQueryOptions.mockReturnValue({
      queryKey: ["getWithdrawRouteChoices", {}],
      enabled: true,
      queryFn: vi.fn().mockRejectedValue(new Error("service down")),
    });

    const { result } = renderHookWithProviders(() =>
      useWithdrawRouteChoices({ config, user: ACCOUNT, amount: 1_000_000n, receiver: RECEIVER }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
