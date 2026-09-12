import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus } from "../types";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { relayInstantOperations } from "./relay-instant-operations";

const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-vibe" };
const OPERATION: SignedOperation = {
  signer: "0x1111111111111111111111111111111111111111",
  target: "0x2222222222222222222222222222222222222222",
  callData: "0xcf70cb69",
  signerAccount: { addr: "0x3333333333333333333333333333333333333333", isPartyB: false },
  flexFields: [],
  maxUses: 1n,
  replayAttackHeader: { nonce: 7n, deadline: 4_102_444_800n, salt: `0x${"11".repeat(32)}` },
};
const ACCEPTED = {
  headers: HEADERS,
  data: { request_id: "req-1", status: "queued", paid_fee: "1000000", remaining_fee_allowance: "5000000" },
};

describe("relayInstantOperations", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("posts the wire body with numeric uint256 fields and parses the receipt", async () => {
    const { config } = gaslessTestConfig();
    post.mockResolvedValue(ACCEPTED);

    const receipt = await relayInstantOperations(config, {
      chainId: GASLESS_TEST_CHAIN,
      userAddress: OPERATION.signer,
      operationType: "addMargin",
      operations: [{ operation: OPERATION, signature: `0x${"ab".repeat(65)}` }],
      idempotencyKey: "idem-1",
    });

    expect(receipt).toEqual({
      requestId: "req-1",
      status: GaslessRequestStatus.QUEUED,
      paidFee: 1_000_000n,
      remainingFeeAllowance: 5_000_000n,
    });

    const [path, body, requestConfig] = post.mock.calls[0] as [string, Record<string, unknown>, { baseURL: string }];
    expect(path).toBe("/gateway/relay-instant");
    expect(requestConfig.baseURL).toBe(
      "https://gaslessq.symmio.foundation/v1/instances/arbitrum-42161-vibe/operations",
    );
    expect(body).toMatchObject({
      idempotencyKey: "idem-1",
      userAddress: OPERATION.signer,
      operationType: "addMargin",
      signatures: [`0x${"ab".repeat(65)}`],
      fills: [[]],
      flexFillerSignatures: [[]],
    });
    const signedOp = (body.signedOps as Record<string, unknown>[])[0]!;
    expect(signedOp.maxUses).toBe(1);
    expect(signedOp.replayAttackHeader).toEqual({
      nonce: 7,
      deadline: 4_102_444_800,
      salt: OPERATION.replayAttackHeader.salt,
    });
  });

  it("retries once with the same idempotency key on a network-level failure", async () => {
    const { config } = gaslessTestConfig();
    /** Snapshot each body as sent: both attempts share one object, so `mock.calls` would compare it with itself. */
    const sent: { idempotencyKey?: unknown }[] = [];
    post.mockImplementation((_path: string, body: { idempotencyKey?: unknown }) => {
      sent.push(structuredClone(body));
      return sent.length === 1
        ? Promise.reject({ isAxiosError: true, message: "socket hang up", config: { url: "/gateway/relay-instant" } })
        : Promise.resolve(ACCEPTED);
    });

    const receipt = await relayInstantOperations(config, {
      chainId: GASLESS_TEST_CHAIN,
      userAddress: OPERATION.signer,
      operationType: "addMargin",
      operations: [{ operation: OPERATION, signature: `0x${"ab".repeat(65)}` }],
    });

    expect(receipt.requestId).toBe("req-1");
    expect(sent).toHaveLength(2);
    expect(sent[0]?.idempotencyKey).toEqual(expect.any(String));
    expect(sent[1]).toEqual(sent[0]);
  });

  it("does not retry a definitive 4xx and preserves the vendor body", async () => {
    const { config } = gaslessTestConfig();
    post.mockRejectedValue({
      isAxiosError: true,
      message: "conflict",
      response: { status: 409, statusText: "Conflict", data: { detail: { code: "FEE_POLICY_WOULD_REVERT" } } },
      config: { url: "/gateway/relay-instant", method: "post" },
    });

    const promise = relayInstantOperations(config, {
      chainId: GASLESS_TEST_CHAIN,
      userAddress: OPERATION.signer,
      operationType: "addMargin",
      operations: [{ operation: OPERATION, signature: `0x${"ab".repeat(65)}` }],
    });

    await expect(promise).rejects.toBeInstanceOf(SymmApiError);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
