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
const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };
const ACCOUNT_DATA = { name: "Main", isolationType: SubAccountIsolationType.MARKET_DIRECTION, singleVAMode: true };
const ACCEPTED = {
  headers: HEADERS,
  data: {
    request_id: "dep-1",
    status: "queued",
    deposit_address: "0x5555555555555555555555555555555555555555",
    observed_amount: "5000000",
    paid_fee: "1000000",
    credited_amount: "4000000",
  },
};

describe("settleGaslessDepositNewAccount", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("posts the new-account body to the deposits service and parses the rich receipt", async () => {
    const { config } = gaslessTestConfig();
    post.mockResolvedValue(ACCEPTED);

    const receipt = await settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      wallet: OWNER,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
      idempotencyKey: "dep-key-1",
    });

    expect(receipt).toEqual({
      requestId: "dep-1",
      status: GaslessRequestStatus.QUEUED,
      depositAddress: "0x5555555555555555555555555555555555555555",
      observedAmount: 5_000_000n,
      paidFee: 1_000_000n,
      creditedAmount: 4_000_000n,
    });

    const [path, body, requestConfig] = post.mock.calls[0] as [string, Record<string, unknown>, { baseURL: string }];
    expect(path).toBe("/deposit-settlements/new-account");
    expect(requestConfig.baseURL).toBe(buildGaslessHttpContext(GASLESS_TEST_CHAIN, TEST_GASLESS, "deposits").baseURL);
    /** Account metadata defaults to `0x`, and an omitted request `metadata` is left off the body entirely. */
    expect(body).toEqual({
      idempotencyKey: "dep-key-1",
      wallet: OWNER,
      affiliate: zeroAddress,
      accountData: {
        name: "Main",
        metadata: "0x",
        isolationType: SubAccountIsolationType.MARKET_DIRECTION,
        singleVAMode: true,
      },
    });
  });

  it("forwards the account's hook metadata and the request's correlation metadata", async () => {
    const { config } = gaslessTestConfig();
    post.mockResolvedValue(ACCEPTED);

    await settleGaslessDepositNewAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      wallet: OWNER,
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
    const { config } = gaslessTestConfig();
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
      wallet: OWNER,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
    });

    expect(receipt.requestId).toBe("dep-1");
    expect(sent).toHaveLength(2);
    /** The key is minted once, before the first attempt — a fresh key on retry could settle twice. */
    expect(sent[0]?.idempotencyKey).toEqual(expect.any(String));
    expect(sent[1]).toEqual(sent[0]);
  });

  it("does not retry a definitive 4xx", async () => {
    const { config } = gaslessTestConfig();
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
      wallet: OWNER,
      affiliate: zeroAddress,
      accountData: ACCOUNT_DATA,
    });

    await expect(settlement).rejects.toBeInstanceOf(SymmApiError);
    await expect(settlement).rejects.toMatchObject({ code: "GASLESS_SETTLEMENT_SUBMIT_FAILED", status: 422 });
    expect(post).toHaveBeenCalledTimes(1);
  });
});
