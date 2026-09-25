import { zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmApiError } from "../../shared/errors/symm-error";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { buildGaslessHttpContext } from "../http";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus } from "../types";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { settleGaslessDepositNewAccount } from "./settle-gasless-deposit-new-account";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const DEPOSIT_ADDRESS = "0x5555555555555555555555555555555555555555" as const;
const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };
const ACCOUNT_DATA = { name: "Main", isolationType: SubAccountIsolationType.MARKET_DIRECTION, singleVAMode: true };
const ACCEPTED = {
  headers: HEADERS,
  data: {
    request_id: "dep-1",
    status: "queued",
    wallet_id: "0",
    deposit_address: DEPOSIT_ADDRESS,
    observed_amount: "5000000",
    paid_fee: "1000000",
    credited_amount: "4000000",
  },
};

/** A config whose GaslessLayer derives {@link DEPOSIT_ADDRESS} for every wallet id. */
function settleTestConfig() {
  const { config, readContract } = gaslessTestConfig();
  readContract.mockResolvedValue(DEPOSIT_ADDRESS);
  return { config, readContract };
}

describe("settleGaslessDepositNewAccount", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("posts the new-account body to the deposits service and parses the rich receipt", async () => {
    const { config } = settleTestConfig();
    post.mockResolvedValue(ACCEPTED);

    const receipt = await settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
      idempotencyKey: "dep-key-1",
    });

    expect(receipt).toEqual({
      requestId: "dep-1",
      status: GaslessRequestStatus.QUEUED,
      depositAddress: DEPOSIT_ADDRESS,
      walletId: 0n,
      owner: OWNER,
      observedAmount: 5_000_000n,
      paidFee: 1_000_000n,
      creditedAmount: 4_000_000n,
      idempotencyKey: "dep-key-1",
      protocolInstance: TEST_GASLESS.protocolInstance,
    });

    const [path, body, requestConfig] = post.mock.calls[0] as [string, Record<string, unknown>, { baseURL: string }];
    expect(path).toBe("/deposit-settlements/new-account");
    expect(requestConfig.baseURL).toBe(buildGaslessHttpContext(GASLESS_TEST_CHAIN, TEST_GASLESS, "deposits").baseURL);
    /** `owner`, never the legacy `wallet` alias; the wallet id is an explicit decimal string. */
    expect(body).toEqual({
      idempotencyKey: "dep-key-1",
      owner: OWNER,
      walletId: "0",
      affiliate: zeroAddress,
      accountData: {
        name: "Main",
        metadata: "0x",
        isolationType: SubAccountIsolationType.MARKET_DIRECTION,
        singleVAMode: true,
      },
    });
  });

  it("settles the selected wallet id and derives that wallet's deposit address", async () => {
    const { config, readContract } = settleTestConfig();
    post.mockResolvedValue({ ...ACCEPTED, data: { ...ACCEPTED.data, wallet_id: "2" } });

    const receipt = await settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 2n,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
    });

    expect(receipt.walletId).toBe(2n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER, 2n] }),
    );
    expect((post.mock.calls[0]?.[1] as { walletId: string }).walletId).toBe("2");
  });

  it("throws GASLESS_DEPOSIT_WALLET_MISMATCH but keeps the request id when the acceptance names another wallet", async () => {
    const { config } = settleTestConfig();
    post.mockResolvedValue({ ...ACCEPTED, data: { ...ACCEPTED.data, wallet_id: "7" } });

    const settlement = settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 2n,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
    });

    await expect(settlement).rejects.toMatchObject({
      code: "GASLESS_DEPOSIT_WALLET_MISMATCH",
      /** The settlement is already accepted: losing its id would make it untrackable. */
      responseData: expect.objectContaining({ requestId: "dep-1", walletId: 7n }),
    });
  });

  it("throws GASLESS_DEPOSIT_WALLET_MISMATCH when the acceptance sweeps another address", async () => {
    const { config } = settleTestConfig();
    post.mockResolvedValue({
      ...ACCEPTED,
      data: { ...ACCEPTED.data, deposit_address: "0x6666666666666666666666666666666666666666" },
    });

    await expect(
      settleGaslessDepositNewAccount(config, {
        chainId: GASLESS_TEST_CHAIN,
        owner: OWNER,
        affiliate: zeroAddress,
        accountData: ACCOUNT_DATA,
      }),
    ).rejects.toMatchObject({ code: "GASLESS_DEPOSIT_WALLET_MISMATCH" });
  });

  it("keeps an acceptance whose amounts, status and wallet id are missing or unknown", async () => {
    const { config } = settleTestConfig();
    post.mockResolvedValue({
      headers: HEADERS,
      data: { request_id: "dep-9", status: "pre_queue_rejected", deposit_address: DEPOSIT_ADDRESS },
    });

    const receipt = await settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
    });

    expect(receipt.requestId).toBe("dep-9");
    /** An unrecognized acceptance status is read as queued — never as a reason to drop the id. */
    expect(receipt.status).toBe(GaslessRequestStatus.QUEUED);
    expect(receipt.walletId).toBe(0n);
    expect(receipt.observedAmount).toBeNull();
    expect(receipt.paidFee).toBeNull();
    expect(receipt.creditedAmount).toBeNull();
  });

  it("forwards the account's hook metadata and the request's correlation metadata", async () => {
    const { config } = settleTestConfig();
    post.mockResolvedValue(ACCEPTED);

    await settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      affiliate: zeroAddress,
      accountData: { ...ACCOUNT_DATA, metadata: "0x1234" },
      idempotencyKey: "dep-key-1",
      metadata: { flow: "onboarding" },
    });

    const body = post.mock.calls[0]?.[1] as { accountData: { metadata: string }; metadata: unknown };
    expect(body.accountData.metadata).toBe("0x1234");
    expect(body.metadata).toEqual({ flow: "onboarding" });
  });

  it("retries once after a network-level failure with the byte-identical body and minted key", async () => {
    const { config } = settleTestConfig();
    /** Snapshot each body as sent: both attempts share one object, so `mock.calls` would compare it with itself. */
    const sent: { idempotencyKey?: unknown }[] = [];
    post.mockImplementation((_path: string, body: { idempotencyKey?: unknown }) => {
      sent.push(structuredClone(body));
      return sent.length === 1
        ? Promise.reject({ isAxiosError: true, message: "socket hang up", config: { url: "/deposit-settlements" } })
        : Promise.resolve(ACCEPTED);
    });

    const receipt = await settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
    });

    expect(receipt.requestId).toBe("dep-1");
    expect(sent).toHaveLength(2);
    /** The key is minted once, before the first attempt — a fresh key on retry could settle twice. */
    expect(sent[0]?.idempotencyKey).toEqual(expect.any(String));
    expect(sent[1]).toEqual(sent[0]);
    expect(receipt.idempotencyKey).toBe(sent[0]?.idempotencyKey);
  });

  it("does not retry a definitive 4xx", async () => {
    const { config } = settleTestConfig();
    post.mockRejectedValue({
      isAxiosError: true,
      message: "unprocessable",
      response: {
        status: 422,
        statusText: "Unprocessable Entity",
        data: { detail: { code: "DEPOSIT_BELOW_MINIMUM" } },
      },
      config: { url: "/deposit-settlements/new-account", method: "post" },
    });

    const settlement = settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
    });

    await expect(settlement).rejects.toBeInstanceOf(SymmApiError);
    await expect(settlement).rejects.toMatchObject({ code: "GASLESS_SETTLEMENT_SUBMIT_FAILED", status: 422 });
    expect(post).toHaveBeenCalledTimes(1);
  });
});
