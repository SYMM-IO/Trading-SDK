import { decodeFunctionData } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig } from "../../core/chains";
import { instantLayerAbi } from "../../symmio-contracts/abi/v0.8.6/instant-layer";
import { GASLESS_TEST_CHAIN, TEST_GASLESS_SIGNER, gaslessWriteTestConfig } from "../test/config";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { relayGrantDelegation } from "./relay-grant-delegation";

const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
const SESSION_KEY = "0x6666666666666666666666666666666666666666" as const;
const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-vibe" };

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
});
