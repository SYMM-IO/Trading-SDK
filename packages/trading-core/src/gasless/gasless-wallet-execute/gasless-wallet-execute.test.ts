import { decodeFunctionData } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gaslessWalletAbi } from "../gateway/gasless-layer-abi";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, TEST_GASLESS_SIGNER, gaslessWriteTestConfig } from "../test/config";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { gaslessWalletExecute } from "./gasless-wallet-execute";

const WALLET = "0x5555555555555555555555555555555555555555" as const;
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-vibe" };

describe("gaslessWalletExecute", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("signs the 5-field gateway-domain struct and ships transport-only flexFields/maxUses", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig();
    readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getGaslessWalletAddress") return Promise.resolve(WALLET);
      if (functionName === "walletOperationNonces") return Promise.resolve(4n);
      return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
    });
    post.mockResolvedValue({
      headers: HEADERS,
      data: { request_id: "req-w1", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" },
    });

    const receipt = await gaslessWalletExecute(config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [{ target: USDC, value: 0n, data: "0xa9059cbb" }],
    });

    expect(receipt.requestId).toBe("req-w1");

    /** Signature: gateway domain, 5-field type table, wallet as target, nonce + 1. */
    const signCall = signTypedData.mock.calls[0]?.[0] as {
      domain: { name: string; verifyingContract: string };
      types: Record<string, unknown>;
      primaryType: string;
      message: {
        target: string;
        signerAccount: { addr: string };
        replayAttackHeader: { nonce: bigint };
        callData: `0x${string}`;
      };
    };
    expect(signCall.domain.name).toBe("GaslessGateway");
    expect(signCall.domain.verifyingContract).toBe(TEST_GASLESS.gaslessLayerAddress);
    expect(signCall.primaryType).toBe("SignedOperation");
    expect(Object.keys(signCall.types)).not.toContain("FlexField");
    expect(signCall.message.target).toBe(WALLET);
    expect(signCall.message.signerAccount.addr).toBe(TEST_GASLESS_SIGNER);
    expect(signCall.message.replayAttackHeader.nonce).toBe(5n);

    const inner = decodeFunctionData({ abi: gaslessWalletAbi, data: signCall.message.callData });
    expect(inner.functionName).toBe("execute");

    /** Transport: numbers + the unsigned flexFields/maxUses fields. */
    const body = post.mock.calls[0]?.[1] as {
      operationType: string;
      signedOps: { flexFields: unknown[]; maxUses: number; replayAttackHeader: { nonce: number } }[];
    };
    expect(body.operationType).toBe("gaslessqWalletExecute");
    expect(body.signedOps[0]?.flexFields).toEqual([]);
    expect(body.signedOps[0]?.maxUses).toBe(1);
    expect(body.signedOps[0]?.replayAttackHeader.nonce).toBe(5);
  });

  it("refuses a zero wallet address from an unwired gateway", async () => {
    const { config, readContract } = gaslessWriteTestConfig();
    readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getGaslessWalletAddress")
        return Promise.resolve("0x0000000000000000000000000000000000000000");
      if (functionName === "walletOperationNonces") return Promise.resolve(0n);
      return Promise.reject(new Error("unprogrammed"));
    });

    await expect(
      gaslessWalletExecute(config, {
        chainId: GASLESS_TEST_CHAIN,
        calls: [{ target: USDC, value: 0n, data: "0xa9059cbb" }],
      }),
    ).rejects.toThrowError(/GASLESS_WALLET_UNAVAILABLE|zero address/);
    expect(post).not.toHaveBeenCalled();
  });
});
