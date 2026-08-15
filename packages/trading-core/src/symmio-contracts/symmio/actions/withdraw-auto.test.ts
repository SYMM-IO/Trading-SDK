import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { SubAccountIsolationType } from "../../account-layer/types";
import { withdrawAuto } from "./withdraw-auto";

const getSubAccount = vi.hoisted(() => vi.fn());
const withdraw = vi.hoisted(() => vi.fn());

vi.mock("../../account-layer/actions/get-sub-account", () => ({ getSubAccount }));
vi.mock("./withdraw", () => ({ withdraw }));

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
// Collateral is 6-decimal (USDC) on the default test chain: 1 USDC.
const COLLATERAL_AMOUNT = 1_000000n;
const AMOUNT_18 = 1_000000000000000000n;

describe("withdrawAuto", () => {
  afterEach(() => {
    getSubAccount.mockReset();
    withdraw.mockReset();
  });

  it("routes a CUSTOM subaccount to the deallocate path with the scaled 18-dec amount", async () => {
    const { config } = mockConfig();
    getSubAccount.mockResolvedValueOnce({ isolationType: SubAccountIsolationType.CUSTOM });
    withdraw.mockResolvedValueOnce(TEST_TX_HASH);

    const hash = await withdrawAuto(config, {
      account: SUB_ACCOUNT,
      amount: COLLATERAL_AMOUNT,
      receiver: RECEIVER,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(getSubAccount).toHaveBeenCalledWith(config, expect.objectContaining({ account: SUB_ACCOUNT }));
    expect(withdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        account: SUB_ACCOUNT,
        isolationType: SubAccountIsolationType.CUSTOM,
        // Collateral-decimals amount is scaled to 18 decimals for the deallocate leg.
        amount: AMOUNT_18,
      }),
    );
    // The withdraw part carries the collateral-decimals amount, receiver, and chain id.
    const withdrawParams = withdraw.mock.calls[0]![1] as {
      parts: readonly { amount: bigint; receiver: Address; chainId: bigint }[];
    };
    expect(withdrawParams.parts).toHaveLength(1);
    expect(withdrawParams.parts[0]).toMatchObject({
      amount: COLLATERAL_AMOUNT,
      receiver: RECEIVER,
      chainId: BigInt(config.defaultChainId),
    });
  });

  it("skips the getSubAccount read when isolationType is passed", async () => {
    const { config } = mockConfig();
    withdraw.mockResolvedValueOnce(TEST_TX_HASH);

    const hash = await withdrawAuto(config, {
      account: SUB_ACCOUNT,
      amount: COLLATERAL_AMOUNT,
      receiver: RECEIVER,
      isolationType: SubAccountIsolationType.CUSTOM,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(getSubAccount).not.toHaveBeenCalled();
    expect(withdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ isolationType: SubAccountIsolationType.CUSTOM, amount: AMOUNT_18 }),
    );
  });

  it("routes a MARKET subaccount to the initiate-only path", async () => {
    const { config } = mockConfig();
    getSubAccount.mockResolvedValueOnce({ isolationType: SubAccountIsolationType.MARKET });
    withdraw.mockResolvedValueOnce(TEST_TX_HASH);

    const hash = await withdrawAuto(config, {
      account: SUB_ACCOUNT,
      amount: COLLATERAL_AMOUNT,
      receiver: RECEIVER,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(withdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ account: SUB_ACCOUNT, isolationType: SubAccountIsolationType.MARKET }),
    );
    const withdrawParams = withdraw.mock.calls[0]![1] as {
      parts: readonly { amount: bigint; receiver: Address; chainId: bigint }[];
    };
    expect(withdrawParams.parts[0]).toMatchObject({
      amount: COLLATERAL_AMOUNT,
      receiver: RECEIVER,
      chainId: BigInt(config.defaultChainId),
    });
  });

  it("routes a MARKET_DIRECTION subaccount to the initiate-only path", async () => {
    const { config } = mockConfig();
    getSubAccount.mockResolvedValueOnce({ isolationType: SubAccountIsolationType.MARKET_DIRECTION });
    withdraw.mockResolvedValueOnce(TEST_TX_HASH);

    const hash = await withdrawAuto(config, {
      account: SUB_ACCOUNT,
      amount: COLLATERAL_AMOUNT,
      receiver: RECEIVER,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(withdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ account: SUB_ACCOUNT, isolationType: SubAccountIsolationType.MARKET_DIRECTION }),
    );
  });

  it("forwards receiver / chainId / speedUp / providerData through to withdraw", async () => {
    const { config } = mockConfig();
    getSubAccount.mockResolvedValueOnce({ isolationType: SubAccountIsolationType.MARKET });
    withdraw.mockResolvedValueOnce(TEST_TX_HASH);

    await withdrawAuto(config, {
      account: SUB_ACCOUNT,
      amount: COLLATERAL_AMOUNT,
      receiver: RECEIVER,
      speedUp: true,
      providerData: "0x1234",
      chainId: config.defaultChainId,
    });

    expect(getSubAccount).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ account: SUB_ACCOUNT, chainId: config.defaultChainId }),
    );
    expect(withdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ speedUp: true, providerData: "0x1234", chainId: config.defaultChainId }),
    );
  });
});
