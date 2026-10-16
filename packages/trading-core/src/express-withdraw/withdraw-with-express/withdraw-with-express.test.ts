import { decodeFunctionData } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getLastWithdrawRequestId = vi.hoisted(() => vi.fn());
const getWithdrawableTime = vi.hoisted(() => vi.fn());
const getAccountBalanceOf = vi.hoisted(() => vi.fn());
const withdrawAuto = vi.hoisted(() => vi.fn());
const callAsSubAccount = vi.hoisted(() => vi.fn());
const submitExpressWithdrawOption = vi.hoisted(() => vi.fn());
const getExpressWithdrawOptions = vi.hoisted(() => vi.fn());

vi.mock("../../symmio-contracts/symmio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../symmio-contracts/symmio")>()),
  getLastWithdrawRequestId,
  getWithdrawableTime,
  withdrawAuto,
}));
vi.mock("../../symmio-contracts/account-layer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../symmio-contracts/account-layer")>()),
  getAccountBalanceOf,
}));
vi.mock("../../symmio-contracts/symmio/internal/call-as-sub-account", () => ({ callAsSubAccount }));
vi.mock("../submit-express-withdraw-option", () => ({ submitExpressWithdrawOption }));
vi.mock("../get-express-withdraw-options", () => ({ getExpressWithdrawOptions }));

import { SymmError } from "../../shared/errors/symm-error";
import { TEST_TX_HASH } from "../../shared/test/mock-config";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer";
import {
  createExpressConfig,
  createExpressOption,
  TEST_ACCOUNT,
  TEST_AMOUNT,
  TEST_AMOUNT_18,
  TEST_BLOCK_TIMESTAMP,
  TEST_RECEIVER,
} from "../test-fixtures";
import { withdrawWithExpress } from "./withdraw-with-express";

describe("withdrawWithExpress", () => {
  beforeEach(() => {
    getLastWithdrawRequestId.mockReset();
    getWithdrawableTime.mockReset();
    getAccountBalanceOf.mockReset();
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT_18);
    withdrawAuto.mockReset();
    callAsSubAccount.mockReset();
    submitExpressWithdrawOption.mockReset();
    getExpressWithdrawOptions.mockReset();
  });

  it.each([
    ["is one unit short of the scaled amount", TEST_AMOUNT_18 - 1n],
    ["only matches the amount in collateral units", TEST_AMOUNT],
  ])("rejects a prepared immediate route whose 18-decimal available balance %s", async (_, balance) => {
    getWithdrawableTime.mockResolvedValue(0n);
    getAccountBalanceOf.mockResolvedValue(balance);

    const rejection = (await withdrawWithExpress(createExpressConfig(), {
      account: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      isolationType: SubAccountIsolationType.MARKET,
      preparedRoute: { kind: "classic", finalize: "immediate", reason: "cooldown-ready" },
    }).catch((error: unknown) => error)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection.code).toBe("WITHDRAW_ROUTE_STALE");
    expect(callAsSubAccount).not.toHaveBeenCalled();
  });

  it("rejects a prepared immediate route whose cooldown ends after the latest block", async () => {
    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP + 1n);

    const rejection = (await withdrawWithExpress(createExpressConfig(), {
      account: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      isolationType: SubAccountIsolationType.MARKET,
      preparedRoute: { kind: "classic", finalize: "immediate", reason: "cooldown-ready" },
    }).catch((error: unknown) => error)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection.code).toBe("WITHDRAW_ROUTE_STALE");
    expect(callAsSubAccount).not.toHaveBeenCalled();
  });

  it("rejects an over-balance amount before any options request or write when no route is prepared", async () => {
    getWithdrawableTime.mockResolvedValue(0n);
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT);

    const rejection = (await withdrawWithExpress(createExpressConfig(), {
      account: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      isolationType: SubAccountIsolationType.MARKET,
    }).catch((error: unknown) => error)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection.code).toBe("WITHDRAW_INSUFFICIENT_BALANCE");
    expect(getExpressWithdrawOptions).not.toHaveBeenCalled();
    expect(callAsSubAccount).not.toHaveBeenCalled();
    expect(withdrawAuto).not.toHaveBeenCalled();
    expect(submitExpressWithdrawOption).not.toHaveBeenCalled();
  });

  it("submits the exact prepared Express option", async () => {
    const config = createExpressConfig();
    const option = createExpressOption();
    submitExpressWithdrawOption.mockResolvedValue(TEST_TX_HASH);

    await expect(
      withdrawWithExpress(config, {
        account: TEST_ACCOUNT,
        amount: TEST_AMOUNT,
        receiver: TEST_RECEIVER,
        isolationType: SubAccountIsolationType.MARKET,
        preparedRoute: { kind: "express", option },
      }),
    ).resolves.toEqual({ hash: TEST_TX_HASH, route: { kind: "express", option } });

    expect(submitExpressWithdrawOption).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ option, account: TEST_ACCOUNT, amount: TEST_AMOUNT, receiver: TEST_RECEIVER }),
    );
  });

  it("rejects a prepared Express route for a CUSTOM account", async () => {
    const rejection = (await withdrawWithExpress(createExpressConfig(), {
      account: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      isolationType: SubAccountIsolationType.CUSTOM,
      preparedRoute: { kind: "express", option: createExpressOption() },
    }).catch((error: unknown) => error)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection.code).toBe("EXPRESS_WITHDRAW_UNSUPPORTED_ACCOUNT");
    expect(submitExpressWithdrawOption).not.toHaveBeenCalled();
  });

  it("batches classic initiate then finalize with the predicted next request id", async () => {
    const config = createExpressConfig();
    getWithdrawableTime.mockResolvedValue(0n);
    getLastWithdrawRequestId.mockResolvedValue(8n);
    callAsSubAccount.mockResolvedValue(TEST_TX_HASH);

    const result = await withdrawWithExpress(config, {
      account: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      isolationType: SubAccountIsolationType.MARKET,
      preparedRoute: { kind: "classic", finalize: "immediate", reason: "cooldown-ready" },
    });

    expect(result.hash).toBe(TEST_TX_HASH);
    const call = callAsSubAccount.mock.calls[0]![1] as { data: readonly `0x${string}`[] };
    expect(call.data).toHaveLength(2);
    expect(decodeFunctionData({ abi: symmioAbi, data: call.data[0]! }).functionName).toBe("initiateWithdraw");
    const finalize = decodeFunctionData({ abi: symmioAbi, data: call.data[1]! });
    expect(finalize.functionName).toBe("finalizeWithdrawRequest");
    expect(finalize.args).toEqual([TEST_ACCOUNT, 9n]);
    expect(getLastWithdrawRequestId).toHaveBeenCalledTimes(1);
    expect(getLastWithdrawRequestId.mock.invocationCallOrder[0]).toBeLessThan(
      callAsSubAccount.mock.invocationCallOrder[0]!,
    );
  });

  it("dispatches classic cooldown routes through withdrawAuto", async () => {
    const config = createExpressConfig();
    withdrawAuto.mockResolvedValue(TEST_TX_HASH);

    await withdrawWithExpress(config, {
      account: TEST_ACCOUNT,
      amount: TEST_AMOUNT,
      receiver: TEST_RECEIVER,
      isolationType: SubAccountIsolationType.CUSTOM,
      preparedRoute: { kind: "classic", finalize: "after-cooldown", reason: "unsupported-account" },
    });

    expect(withdrawAuto).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ isolationType: SubAccountIsolationType.CUSTOM }),
    );
  });
});
