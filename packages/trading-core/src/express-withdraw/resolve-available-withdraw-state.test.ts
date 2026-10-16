import type { PublicClient } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getWithdrawableTime = vi.hoisted(() => vi.fn());
const getAccountBalanceOf = vi.hoisted(() => vi.fn());

vi.mock("../symmio-contracts/account-layer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../symmio-contracts/account-layer")>()),
  getAccountBalanceOf,
}));
vi.mock("../symmio-contracts/symmio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../symmio-contracts/symmio")>()),
  getWithdrawableTime,
}));

import { SymmioSupportedChainId } from "../core/chains";
import { resolveAvailableWithdrawState } from "./resolve-available-withdraw-state";
import { createExpressConfig, TEST_ACCOUNT, TEST_AMOUNT, TEST_AMOUNT_18, TEST_BLOCK_TIMESTAMP } from "./test-fixtures";

const PARAMETERS = { user: TEST_ACCOUNT, amount: TEST_AMOUNT, chainId: SymmioSupportedChainId.ARBITRUM } as const;

describe("resolveAvailableWithdrawState", () => {
  const getBlock = vi.fn();

  beforeEach(() => {
    getWithdrawableTime.mockReset();
    getAccountBalanceOf.mockReset();
    getBlock.mockReset();
    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP);
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT_18);
    getBlock.mockResolvedValue({ timestamp: TEST_BLOCK_TIMESTAMP });
  });

  afterEach(() => vi.useRealTimers());

  function config(options?: { collateralDecimals?: number }) {
    return createExpressConfig({ ...options, client: { getBlock } as unknown as PublicClient });
  }

  it("reads the account's withdrawable time, available balance, and the latest block on the given chain", async () => {
    await resolveAvailableWithdrawState(config(), PARAMETERS);

    expect(getWithdrawableTime).toHaveBeenCalledWith(expect.anything(), {
      user: TEST_ACCOUNT,
      chainId: SymmioSupportedChainId.ARBITRUM,
    });
    expect(getAccountBalanceOf).toHaveBeenCalledWith(expect.anything(), {
      account: TEST_ACCOUNT,
      chainId: SymmioSupportedChainId.ARBITRUM,
    });
    expect(getBlock).toHaveBeenCalledWith({ blockTag: "latest" });
  });

  it("scales a 6-decimal collateral amount to 18 decimals before comparing it with the balance", async () => {
    await expect(resolveAvailableWithdrawState(config(), PARAMETERS)).resolves.toMatchObject({
      sufficientBalance: true,
    });

    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT_18 - 1n);
    await expect(resolveAvailableWithdrawState(config(), PARAMETERS)).resolves.toMatchObject({
      sufficientBalance: false,
    });

    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT);
    await expect(resolveAvailableWithdrawState(config(), PARAMETERS)).resolves.toMatchObject({
      sufficientBalance: false,
    });
  });

  it("compares an 18-decimal collateral amount with the balance unscaled", async () => {
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT);
    await expect(resolveAvailableWithdrawState(config({ collateralDecimals: 18 }), PARAMETERS)).resolves.toMatchObject({
      sufficientBalance: true,
    });

    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT - 1n);
    await expect(resolveAvailableWithdrawState(config({ collateralDecimals: 18 }), PARAMETERS)).resolves.toMatchObject({
      sufficientBalance: false,
    });
  });

  it.each([
    ["far behind", new Date("2001-01-01T00:00:00Z")],
    ["far ahead of", new Date("2040-01-01T00:00:00Z")],
  ])("judges the cooldown at the latest block's timestamp with a local clock %s chain time", async (_, now) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP);
    await expect(resolveAvailableWithdrawState(config(), PARAMETERS)).resolves.toMatchObject({ cooldownReady: true });

    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP + 1n);
    await expect(resolveAvailableWithdrawState(config(), PARAMETERS)).resolves.toMatchObject({ cooldownReady: false });
  });
});
