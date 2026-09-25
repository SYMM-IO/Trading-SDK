import { beforeEach, describe, expect, it, vi } from "vitest";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus } from "../types";
import type { GaslessUnconfirmedSubmit } from "../unconfirmed-submit";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { resubmitGaslessRequest } from "./resubmit-gasless-request";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const DEPOSIT_ADDRESS = "0x5555555555555555555555555555555555555555" as const;
const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };

/** The body of a relay submit, exactly as `relayInstantOperations` serialized it. */
const RELAY_BODY = {
  idempotencyKey: "key-1",
  userAddress: OWNER,
  operationType: "addMargin",
  signedOps: [{ signer: OWNER }],
  signatures: [`0x${"ab".repeat(65)}`],
  walletIds: ["0", "2"],
};

const RELAY_SUBMIT: GaslessUnconfirmedSubmit = {
  chainId: GASLESS_TEST_CHAIN,
  service: "operations",
  path: "/gateway/relay-instant",
  body: RELAY_BODY,
  idempotencyKey: "key-1",
};

const DEPOSIT_SUBMIT: GaslessUnconfirmedSubmit = {
  chainId: GASLESS_TEST_CHAIN,
  service: "deposits",
  path: "/deposit-settlements/existing-account",
  body: { idempotencyKey: "dep-key", owner: OWNER, walletId: "1", subAccount: OWNER },
  idempotencyKey: "dep-key",
};

describe("resubmitGaslessRequest", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("resends the recorded bytes, unchanged, under the recorded key", async () => {
    const { config } = gaslessTestConfig();
    post.mockResolvedValue({ headers: HEADERS, data: { request_id: "req-1", status: "queued" } });

    const receipt = await resubmitGaslessRequest(config, RELAY_SUBMIT);

    expect(post).toHaveBeenCalledTimes(1);
    const [path, body] = post.mock.calls[0] ?? [];
    expect(path).toBe("/gateway/relay-instant");
    /** The same object reference: a rebuilt payload would be a different request under a bound key. */
    expect(body).toBe(RELAY_BODY);
    expect(receipt).toMatchObject({
      requestId: "req-1",
      status: GaslessRequestStatus.QUEUED,
      idempotencyKey: "key-1",
      owner: OWNER,
      protocolInstance: TEST_GASLESS.protocolInstance,
    });
    expect((receipt as { walletIds: readonly bigint[] }).walletIds).toEqual([0n, 2n]);
  });

  it("verifies a deposit replay against the wallet it was recorded for, reading the address first", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(DEPOSIT_ADDRESS);
    post.mockResolvedValue({
      headers: HEADERS,
      data: { request_id: "dep-1", status: "queued", wallet_id: "1", deposit_address: DEPOSIT_ADDRESS },
    });

    const receipt = await resubmitGaslessRequest(config, DEPOSIT_SUBMIT);

    expect(readContract).toHaveBeenCalled();
    expect(receipt).toMatchObject({ requestId: "dep-1", walletId: 1n, owner: OWNER, idempotencyKey: "dep-key" });
  });

  it("refuses a deposit replay whose acceptance names another wallet", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(DEPOSIT_ADDRESS);
    post.mockResolvedValue({
      headers: HEADERS,
      data: { request_id: "dep-1", status: "queued", wallet_id: "7", deposit_address: DEPOSIT_ADDRESS },
    });

    await expect(resubmitGaslessRequest(config, DEPOSIT_SUBMIT)).rejects.toMatchObject({
      code: "GASLESS_DEPOSIT_WALLET_MISMATCH",
    });
  });

  it("refuses a record that is not a submit this SDK produced", async () => {
    const { config } = gaslessTestConfig();

    await expect(resubmitGaslessRequest(config, { ...RELAY_SUBMIT, body: "not a body" })).rejects.toMatchObject({
      code: "GASLESS_RESUBMIT_BODY_INVALID",
    });
    await expect(
      resubmitGaslessRequest(config, { ...RELAY_SUBMIT, body: { ...RELAY_BODY, userAddress: undefined } }),
    ).rejects.toMatchObject({ code: "GASLESS_RESUBMIT_BODY_INVALID" });
    expect(post).not.toHaveBeenCalled();
  });

  it("reports a replay that is itself inconclusive as unconfirmed again", async () => {
    const { config } = gaslessTestConfig();
    post.mockRejectedValue({
      isAxiosError: true,
      message: "socket hang up",
      config: { url: "/gateway/relay-instant" },
    });

    await expect(resubmitGaslessRequest(config, RELAY_SUBMIT)).rejects.toMatchObject({
      code: "GASLESS_SUBMIT_UNCONFIRMED",
    });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
