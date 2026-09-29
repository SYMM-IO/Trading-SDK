import {
  createConfig,
  GaslessRequestStatus,
  SymmioSupportedChainId,
  type GaslessUnconfirmedSubmit,
} from "@symmio/trading-core";
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";

const resubmitGaslessRequest = vi.hoisted(() => vi.fn());
const confirmGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    resubmitGaslessRequestMutationOptions: () => ({
      mutationKey: ["resubmitGaslessRequest"] as const,
      mutationFn: resubmitGaslessRequest,
    }),
    confirmGaslessRequest,
  };
});

import { useResubmitGaslessRequest } from "./use-resubmit-gasless-request";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const SIGNER = "0xBabAD9AAA1a617886c272CEC2Ce7A132Fe2ECf29";
const TX_HASH = `0x${"cd".repeat(32)}` as const;

const SUBMIT: GaslessUnconfirmedSubmit = {
  chainId: CHAIN,
  service: "operations",
  path: "/gateway/relay-instant",
  body: {
    idempotencyKey: "key-1",
    userAddress: SIGNER,
    signedOps: [{ signerAccount: { addr: SIGNER, isPartyB: false } }],
  },
  idempotencyKey: "key-1",
};

function buildConfig() {
  return createConfig({
    getClient: () => ({ waitForTransactionReceipt: vi.fn() }) as unknown as PublicClient,
    symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
  });
}

describe("useResubmitGaslessRequest", () => {
  beforeEach(() => {
    resubmitGaslessRequest.mockReset();
    confirmGaslessRequest.mockReset();
    resubmitGaslessRequest.mockResolvedValue({ requestId: "req-1", status: GaslessRequestStatus.QUEUED });
    confirmGaslessRequest.mockImplementation(async () => ({
      request: { requestId: "req-1", status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH },
      txHash: TX_HASH,
    }));
  });

  it("forwards the recorded submit untouched and confirms on its own service and chain", async () => {
    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useResubmitGaslessRequest({ config }));

    const resolved = await result.current.mutateAsync(SUBMIT);

    /** Byte-identical: a rebuilt payload under a bound key is a different request. */
    expect(resubmitGaslessRequest).toHaveBeenCalledWith(SUBMIT);
    expect(resolved.accepted.requestId).toBe("req-1");
    expect(resolved.confirmed?.txHash).toBe(TX_HASH);
    expect(confirmGaslessRequest).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: CHAIN, service: "operations", requestId: "req-1" }),
    );
  });

  it("confirms a settlement replay against the deposits service", async () => {
    const config = buildConfig();
    resubmitGaslessRequest.mockResolvedValue({
      requestId: "dep-1",
      status: GaslessRequestStatus.QUEUED,
      walletId: 1n,
      owner: SIGNER,
      depositAddress: SIGNER,
    });
    const { result } = renderHookWithProviders(() => useResubmitGaslessRequest({ config }));

    await result.current.mutateAsync({
      ...SUBMIT,
      service: "deposits",
      path: "/deposit-settlements/existing-account",
      body: { idempotencyKey: "dep-key", owner: SIGNER, walletId: "1" },
    });

    expect(confirmGaslessRequest).toHaveBeenCalledWith(config, expect.objectContaining({ service: "deposits" }));
  });
});
