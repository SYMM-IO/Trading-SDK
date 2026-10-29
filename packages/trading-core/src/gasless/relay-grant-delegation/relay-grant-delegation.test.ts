import { decodeFunctionData } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig } from "../../core/chains";
import { instantLayerAbi } from "../../symmio-contracts/abi/v0.8.6/instant-layer";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, TEST_GASLESS_SIGNER, gaslessWriteTestConfig } from "../test/config";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { relayGrantDelegation } from "./relay-grant-delegation";

const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
const SESSION_KEY = "0x6666666666666666666666666666666666666666" as const;
const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };

describe("relayGrantDelegation", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("relays an owner-signed grantDelegation operation targeting the InstantLayer", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig();
    readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "nonces") return Promise.resolve(2n);
      return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
    });
    post.mockResolvedValue({
      headers: HEADERS,
      data: { request_id: "req-d1", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" },
    });

    const receipt = await relayGrantDelegation(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: SUB_ACCOUNT,
      delegatedSigner: SESSION_KEY,
      selectors: ["0xcf70cb69"],
      expiryTimestamp: 4_102_444_800n,
    });

    expect(receipt.requestId).toBe("req-d1");

    /** InstantLayer domain (NOT the gateway domain). */
    const signCall = signTypedData.mock.calls[0]?.[0] as {
      domain: { name: string; verifyingContract: string };
      message: { target: string; callData: `0x${string}`; signerAccount: { addr: string } };
    };
    expect(signCall.domain.name).toBe("SymmioInstantLayer");
    expect(signCall.domain.verifyingContract).toBe(getChainConfig(GASLESS_TEST_CHAIN).addresses.instantLayerAddress);
    expect(signCall.message.target).toBe(getChainConfig(GASLESS_TEST_CHAIN).addresses.instantLayerAddress);
    expect(signCall.message.signerAccount.addr).toBe(SUB_ACCOUNT);

    const inner = decodeFunctionData({ abi: instantLayerAbi, data: signCall.message.callData });
    expect(inner.functionName).toBe("grantDelegation");

    const body = post.mock.calls[0]?.[1] as {
      operationType: string;
      userAddress: string;
      signedOps: { replayAttackHeader: { nonce: number }; maxUses: number }[];
    };
    expect(body.operationType).toBe("grantDelegation");
    expect(body.userAddress).toBe(TEST_GASLESS_SIGNER);
    expect(body.signedOps[0]?.replayAttackHeader.nonce).toBe(3);
    expect(body.signedOps[0]?.maxUses).toBe(1);
  });

  describe("caller-owned idempotency key", () => {
    const GRANT = {
      chainId: GASLESS_TEST_CHAIN,
      account: SUB_ACCOUNT,
      delegatedSigner: SESSION_KEY,
      selectors: ["0xcf70cb69"],
      expiryTimestamp: 4_102_444_800n,
    } as const;

    afterEach(() => {
      vi.useRealTimers();
    });

    it("sends the key, and answers a same-key retry with the accepted receipt instead of a second prompt", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig();
      readContract.mockResolvedValue(2n);
      post.mockResolvedValue({
        headers: HEADERS,
        data: { request_id: "req-d1", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" },
      });

      const first = await relayGrantDelegation(config, { ...GRANT, idempotencyKey: "grant-1" });
      const retry = await relayGrantDelegation(config, { ...GRANT, idempotencyKey: "grant-1" });

      expect((post.mock.calls[0]?.[1] as { idempotencyKey: string }).idempotencyKey).toBe("grant-1");
      expect(retry).toEqual(first);
      expect(signTypedData).toHaveBeenCalledOnce();
      expect(post).toHaveBeenCalledOnce();
    });

    it("rejects an invalid key before any read or prompt", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig();

      await expect(relayGrantDelegation(config, { ...GRANT, idempotencyKey: "" })).rejects.toMatchObject({
        code: "GASLESS_IDEMPOTENCY_KEY_INVALID",
      });
      expect(readContract).not.toHaveBeenCalled();
      expect(signTypedData).not.toHaveBeenCalled();
    });

    it("fixes the signature deadline when the call starts", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
      const startedAt = Math.floor(Date.now() / 1000);
      const { config, readContract } = gaslessWriteTestConfig();
      /** The nonce read answers a minute later, so signing happens a minute after the call started. */
      readContract.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(2n), 60_000)));
      post.mockResolvedValue({
        headers: HEADERS,
        data: { request_id: "req-d1", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" },
      });

      const pending = relayGrantDelegation(config, { ...GRANT, idempotencyKey: "grant-2" });
      await vi.advanceTimersByTimeAsync(61_000);
      await pending;

      const body = post.mock.calls[0]?.[1] as { signedOps: { replayAttackHeader: { deadline: number } }[] };
      expect(body.signedOps[0]?.replayAttackHeader.deadline).toBe(startedAt + 20 * 60);
    });
  });
});
