import { zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { GaslessRequestStatus } from "../types";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { settleGaslessDepositExistingAccount } from "../settle-gasless-deposit-existing-account/settle-gasless-deposit-existing-account";
import { settleGaslessDepositNewAccount } from "./settle-gasless-deposit-new-account";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-vibe" };
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

describe("deposit settlements", () => {
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
      accountData: { name: "Main", isolationType: SubAccountIsolationType.MARKET_DIRECTION, singleVAMode: true },
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
    expect(requestConfig.baseURL).toBe("https://gaslessq.symmio.foundation/v1/instances/arbitrum-42161-vibe/deposits");
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

  it("posts the strict existing-account body (no extra fields)", async () => {
    const { config } = gaslessTestConfig();
    post.mockResolvedValue(ACCEPTED);

    await settleGaslessDepositExistingAccount(config, {
      chainId: GASLESS_TEST_CHAIN,
      wallet: OWNER,
      subAccount: SUB_ACCOUNT,
      idempotencyKey: "dep-key-2",
    });

    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).toEqual({ idempotencyKey: "dep-key-2", wallet: OWNER, subAccount: SUB_ACCOUNT });
  });
});
