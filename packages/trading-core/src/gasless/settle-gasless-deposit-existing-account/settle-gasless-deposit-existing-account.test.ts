import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import { buildGaslessHttpContext } from "../http";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus } from "../types";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { settleGaslessDepositExistingAccount } from "./settle-gasless-deposit-existing-account";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
const DEPOSIT_ADDRESS = "0x5555555555555555555555555555555555555555" as const;
const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };
const ACCEPTED = {
  headers: HEADERS,
  data: {
    request_id: "dep-2",
    status: "queued",
    wallet_id: "1",
    deposit_address: DEPOSIT_ADDRESS,
    observed_amount: "5000000",
    paid_fee: "1000000",
    credited_amount: "4000000",
  },
};
const NETWORK_FAILURE = { isAxiosError: true, message: "socket hang up", config: { url: "/deposit-settlements" } };
const SERVER_FAILURE = {
  isAxiosError: true,
  message: "bad gateway",
  response: { status: 502, statusText: "Bad Gateway", data: {} },
  config: { url: "/deposit-settlements", method: "post" },
};

/** A config whose GaslessLayer derives {@link DEPOSIT_ADDRESS} for every wallet id. */
function settleTestConfig() {
  const { config, readContract } = gaslessTestConfig();
  readContract.mockResolvedValue(DEPOSIT_ADDRESS);
  return { config, readContract };
}

describe("settleGaslessDepositExistingAccount", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("posts the strict existing-account body to the deposits service and parses the receipt", async () => {
    const { config } = settleTestConfig();
    post.mockResolvedValue(ACCEPTED);

    const receipt = await settleGaslessDepositExistingAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 1n,
      subAccount: SUB_ACCOUNT,
      idempotencyKey: "dep-key-2",
    });

    expect(receipt).toEqual({
      requestId: "dep-2",
      status: GaslessRequestStatus.QUEUED,
      depositAddress: DEPOSIT_ADDRESS,
      walletId: 1n,
      owner: OWNER,
      observedAmount: 5_000_000n,
      paidFee: 1_000_000n,
      creditedAmount: 4_000_000n,
      idempotencyKey: "dep-key-2",
      protocolInstance: TEST_GASLESS.protocolInstance,
    });

    const [path, body, requestConfig] = post.mock.calls[0] as [string, Record<string, unknown>, { baseURL: string }];
    expect(path).toBe("/deposit-settlements/existing-account");
    expect(requestConfig.baseURL).toBe(buildGaslessHttpContext(GASLESS_TEST_CHAIN, TEST_GASLESS, "deposits").baseURL);
    /** The service model rejects unknown fields — the body carries exactly these four. */
    expect(body).toEqual({ idempotencyKey: "dep-key-2", owner: OWNER, walletId: "1", subAccount: SUB_ACCOUNT });
  });

  it("derives the selected wallet's deposit address and rejects an acceptance for another wallet", async () => {
    const { config, readContract } = settleTestConfig();
    post.mockResolvedValue({ ...ACCEPTED, data: { ...ACCEPTED.data, wallet_id: "4" } });

    const settlement = settleGaslessDepositExistingAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 1n,
      subAccount: SUB_ACCOUNT,
    });

    await expect(settlement).rejects.toMatchObject({
      code: "GASLESS_DEPOSIT_WALLET_MISMATCH",
      responseData: expect.objectContaining({ requestId: "dep-2" }),
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER, 1n] }),
    );
  });

  it("mints an idempotency key when the caller passes none", async () => {
    const { config } = settleTestConfig();
    post.mockResolvedValue(ACCEPTED);

    await settleGaslessDepositExistingAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 1n,
      subAccount: SUB_ACCOUNT,
    });

    const body = post.mock.calls[0]?.[1] as { idempotencyKey: string };
    expect(body.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it.each([
    { label: "a network-level failure", failure: NETWORK_FAILURE },
    { label: "a 5xx", failure: SERVER_FAILURE },
  ])("retries once after $label with the byte-identical body and key", async ({ failure }) => {
    const { config } = settleTestConfig();
    /** Snapshot each body as sent: both attempts share one object, so `mock.calls` would compare it with itself. */
    const sent: unknown[] = [];
    post.mockImplementation((_path: string, body: unknown) => {
      sent.push(structuredClone(body));
      return sent.length === 1 ? Promise.reject(failure) : Promise.resolve(ACCEPTED);
    });

    const receipt = await settleGaslessDepositExistingAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 1n,
      subAccount: SUB_ACCOUNT,
    });

    expect(receipt.requestId).toBe("dep-2");
    expect(sent).toHaveLength(2);
    /** Same key, same body: the service returns the accepted record instead of settling twice. */
    expect(sent[1]).toEqual(sent[0]);
  });

  it("gives up after the single retry", async () => {
    const { config } = settleTestConfig();
    post.mockRejectedValue(NETWORK_FAILURE);

    const settlement = settleGaslessDepositExistingAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 1n,
      subAccount: SUB_ACCOUNT,
    });

    await expect(settlement).rejects.toMatchObject({ code: "GASLESS_SUBMIT_UNCONFIRMED", status: 0 });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("does not retry a definitive 4xx and preserves the vendor body", async () => {
    const { config } = settleTestConfig();
    const vendorBody = { detail: { code: "SUB_ACCOUNT_NOT_OWNED" } };
    post.mockRejectedValue({
      isAxiosError: true,
      message: "forbidden",
      response: { status: 403, statusText: "Forbidden", data: vendorBody },
      config: { url: "/deposit-settlements/existing-account", method: "post" },
    });

    const settlement = settleGaslessDepositExistingAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 1n,
      subAccount: SUB_ACCOUNT,
    });

    await expect(settlement).rejects.toBeInstanceOf(SymmApiError);
    await expect(settlement).rejects.toMatchObject({ status: 403, responseData: vendorBody });
    expect(post).toHaveBeenCalledTimes(1);
  });
});
