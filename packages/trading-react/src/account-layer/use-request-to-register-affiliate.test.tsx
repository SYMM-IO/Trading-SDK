import type { RequestToRegisterAffiliateParameters } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_TX_HASH } from "../test/test-utils";
import { useRequestToRegisterAffiliate } from "./use-request-to-register-affiliate";

const ADMIN: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CORE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";

const VARS: RequestToRegisterAffiliateParameters = {
  registration: {
    name: "Acme",
    brandColor: "#ff5c39",
    admin: ADMIN,
    stakeholders: [{ receiver: ADMIN, share: 900000000000000000n }],
    symmioShare: 100000000000000000n,
    metadata: "0x",
    legacyMultiAccounts: [],
    symmioCores: [CORE],
  },
};

describe("useRequestToRegisterAffiliate", () => {
  it("rejects with kind 'sdk' when no wallet is connected, without writing", async () => {
    const { config, writeContract } = createMockSymmioConfig({ withWallet: false });
    const { result } = renderHookWithProviders(() => useRequestToRegisterAffiliate({ config, waitForReceipt: false }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(VARS);
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as { kind: string }).kind).toBe("sdk");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("writes requestToRegisterAffiliate and returns the tx hash when waitForReceipt is false", async () => {
    const { config, writeContract } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);

    const { result } = renderHookWithProviders(() => useRequestToRegisterAffiliate({ config, waitForReceipt: false }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARS);
    });

    expect(res).toEqual({ hash: TEST_TX_HASH });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "requestToRegisterAffiliate", args: [VARS.registration] }),
    );
  });

  it("waits for the receipt by default", async () => {
    const { config, writeContract, waitForTransactionReceipt } = createMockSymmioConfig();
    writeContract.mockResolvedValueOnce(TEST_TX_HASH);
    waitForTransactionReceipt.mockResolvedValueOnce({ status: "success" });

    const { result } = renderHookWithProviders(() => useRequestToRegisterAffiliate({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync(VARS);
    });

    expect(res).toEqual({ hash: TEST_TX_HASH, receipt: { status: "success" } });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: TEST_TX_HASH, confirmations: 1 });
  });
});
