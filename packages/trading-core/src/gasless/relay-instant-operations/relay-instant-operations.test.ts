import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import type { SignedOperation } from "../../solvers/instant-open/shared/types";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus } from "../types";
import { getGaslessUnconfirmedSubmit } from "../unconfirmed-submit";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { relayInstantOperations } from "./relay-instant-operations";

const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };
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
      idempotencyKey: "idem-1",
      protocolInstance: TEST_GASLESS.protocolInstance,
      owner: OPERATION.signer,
      walletIds: [0n],
    });

    const [path, body, requestConfig] = post.mock.calls[0] as [string, Record<string, unknown>, { baseURL: string }];
    expect(path).toBe("/gateway/relay-instant");
    expect(requestConfig.baseURL).toBe(`${TEST_GASLESS.url}/v1/instances/${TEST_GASLESS.protocolInstance}/operations`);
    expect(body).toMatchObject({
      idempotencyKey: "idem-1",
      userAddress: OPERATION.signer,
      operationType: "addMargin",
      signatures: [`0x${"ab".repeat(65)}`],
      /** Always explicit, never left to the service's legacy zero-filling default. */
      walletIds: ["0"],
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

  it("sends one decimal wallet id per operation, in signedOps order", async () => {
    const { config } = gaslessTestConfig();
    post.mockResolvedValue(ACCEPTED);

    const receipt = await relayInstantOperations(config, {
      chainId: GASLESS_TEST_CHAIN,
      userAddress: OPERATION.signer,
      operationType: "gaslessqWalletExecute",
      operations: [
        { operation: OPERATION, signature: `0x${"ab".repeat(65)}` },
        { operation: OPERATION, signature: `0x${"cd".repeat(65)}`, walletId: 2n },
      ],
    });

    const body = post.mock.calls[0]?.[1] as { walletIds: string[] };
    expect(body.walletIds).toEqual(["0", "2"]);
    expect(receipt.walletIds).toEqual([0n, 2n]);
  });

  it("rejects an empty batch before any request", async () => {
    const { config } = gaslessTestConfig();

    await expect(
      relayInstantOperations(config, {
        chainId: GASLESS_TEST_CHAIN,
        userAddress: OPERATION.signer,
        operationType: "addMargin",
        operations: [],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_EMPTY_BATCH" });
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses a template batch that selects a wallet, and a templateId that is not a safe integer", async () => {
    const { config } = gaslessTestConfig();

    await expect(
      relayInstantOperations(config, {
        chainId: GASLESS_TEST_CHAIN,
        userAddress: OPERATION.signer,
        operationType: "addMargin",
        templateId: 3,
        operations: [{ operation: OPERATION, signature: `0x${"ab".repeat(65)}`, walletId: 1n }],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_TEMPLATE_WALLET_ID_UNSUPPORTED" });

    /** An unguarded NaN serializes to `null`, which the service reads as "no template". */
    await expect(
      relayInstantOperations(config, {
        chainId: GASLESS_TEST_CHAIN,
        userAddress: OPERATION.signer,
        operationType: "addMargin",
        templateId: Number.NaN,
        operations: [{ operation: OPERATION, signature: `0x${"ab".repeat(65)}` }],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_TEMPLATE_ID_INVALID" });

    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a wallet id outside the uint256 range before signing anything to the wire", async () => {
    const { config } = gaslessTestConfig();

    await expect(
      relayInstantOperations(config, {
        chainId: GASLESS_TEST_CHAIN,
        userAddress: OPERATION.signer,
        operationType: "addMargin",
        operations: [{ operation: OPERATION, signature: `0x${"ab".repeat(65)}`, walletId: -1n }],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_WALLET_ID_INVALID" });
    expect(post).not.toHaveBeenCalled();
  });

  it("keeps the request id when the acceptance reports no amounts and an unknown status", async () => {
    const { config } = gaslessTestConfig();
    post.mockResolvedValue({ headers: HEADERS, data: { request_id: "req-9", status: "pre_queue_rejected" } });

    const receipt = await relayInstantOperations(config, {
      chainId: GASLESS_TEST_CHAIN,
      userAddress: OPERATION.signer,
      operationType: "addMargin",
      operations: [{ operation: OPERATION, signature: `0x${"ab".repeat(65)}` }],
    });

    expect(receipt.requestId).toBe("req-9");
    expect(receipt.status).toBe(GaslessRequestStatus.QUEUED);
    expect(receipt.paidFee).toBeNull();
    expect(receipt.remainingFeeAllowance).toBeNull();
  });

  it("reports an acceptance with no request id as unconfirmed, with the bytes to replay", async () => {
    const { config } = gaslessTestConfig();
    post.mockResolvedValue({ headers: HEADERS, data: { status: "queued" } });

    const error = await relayInstantOperations(config, {
      chainId: GASLESS_TEST_CHAIN,
      userAddress: OPERATION.signer,
      operationType: "addMargin",
      operations: [{ operation: OPERATION, signature: `0x${"ab".repeat(65)}` }],
      idempotencyKey: "key-1",
    }).catch((err: unknown) => err);

    expect(error).toMatchObject({ code: "GASLESS_SUBMIT_UNCONFIRMED" });
    const submit = getGaslessUnconfirmedSubmit(error);
    expect(submit).toMatchObject({
      chainId: GASLESS_TEST_CHAIN,
      service: "operations",
      path: "/gateway/relay-instant",
      idempotencyKey: "key-1",
    });
    /** The recorded body is the object that was sent, so a replay is byte-identical. */
    expect(submit?.body).toBe(post.mock.calls[0]?.[1]);
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
