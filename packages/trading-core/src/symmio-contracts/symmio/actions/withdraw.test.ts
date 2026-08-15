import type { Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { SubAccountIsolationType, type SingleUpnlSig } from "../../account-layer/types";
import { createClassicWithdrawPart } from "../parts";
import { withdraw } from "./withdraw";

const deallocateAndInitiateWithdraw = vi.hoisted(() => vi.fn());
const initiateWithdraw = vi.hoisted(() => vi.fn());

vi.mock("./deallocate-and-initiate-withdraw", () => ({ deallocateAndInitiateWithdraw }));
vi.mock("./initiate-withdraw", () => ({ initiateWithdraw }));

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const AMOUNT = 1_000000000000000000n;
const PARTS = [createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: RECEIVER, chainId: 999n })];
const UPNL_SIG: SingleUpnlSig = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  upnl: -25_000000000000000000n,
  gatewaySignature: "0xabcd",
  sigs: {
    signature: 99n,
    owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  },
};

describe("withdraw", () => {
  afterEach(() => {
    deallocateAndInitiateWithdraw.mockReset();
    initiateWithdraw.mockReset();
  });

  it("routes a CUSTOM subaccount (with amount) to deallocateAndInitiateWithdraw", async () => {
    const { config } = mockConfig();
    deallocateAndInitiateWithdraw.mockResolvedValueOnce(TEST_TX_HASH);

    const hash = await withdraw(config, {
      account: SUB_ACCOUNT,
      isolationType: SubAccountIsolationType.CUSTOM,
      parts: PARTS,
      amount: AMOUNT,
      upnlSig: UPNL_SIG,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(deallocateAndInitiateWithdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ account: SUB_ACCOUNT, amount: AMOUNT, parts: PARTS, upnlSig: UPNL_SIG }),
    );
    expect(initiateWithdraw).not.toHaveBeenCalled();
  });

  it("throws WITHDRAW_AMOUNT_REQUIRED for a CUSTOM subaccount without amount", async () => {
    const { config } = mockConfig();

    await expect(
      withdraw(config, { account: SUB_ACCOUNT, isolationType: SubAccountIsolationType.CUSTOM, parts: PARTS }),
    ).rejects.toMatchObject({
      name: "SymmError",
      kind: "validation",
      code: "WITHDRAW_AMOUNT_REQUIRED",
    });
    expect(deallocateAndInitiateWithdraw).not.toHaveBeenCalled();
    expect(initiateWithdraw).not.toHaveBeenCalled();
  });

  it("throws a SymmError instance for a CUSTOM subaccount without amount", async () => {
    const { config } = mockConfig();

    await expect(
      withdraw(config, { account: SUB_ACCOUNT, isolationType: SubAccountIsolationType.CUSTOM, parts: PARTS }),
    ).rejects.toThrow(SymmError);
  });

  it("routes a MARKET subaccount to initiateWithdraw (ignoring amount)", async () => {
    const { config } = mockConfig();
    initiateWithdraw.mockResolvedValueOnce(TEST_TX_HASH);

    const hash = await withdraw(config, {
      account: SUB_ACCOUNT,
      isolationType: SubAccountIsolationType.MARKET,
      parts: PARTS,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(initiateWithdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ account: SUB_ACCOUNT, parts: PARTS }),
    );
    expect(deallocateAndInitiateWithdraw).not.toHaveBeenCalled();
  });

  it("routes a MARKET_DIRECTION subaccount to initiateWithdraw", async () => {
    const { config } = mockConfig();
    initiateWithdraw.mockResolvedValueOnce(TEST_TX_HASH);

    const hash = await withdraw(config, {
      account: SUB_ACCOUNT,
      isolationType: SubAccountIsolationType.MARKET_DIRECTION,
      parts: PARTS,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(initiateWithdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ account: SUB_ACCOUNT, parts: PARTS }),
    );
    expect(deallocateAndInitiateWithdraw).not.toHaveBeenCalled();
  });

  it("forwards speedUp / providerData / chainId through the MARKET path", async () => {
    const { config } = mockConfig();
    initiateWithdraw.mockResolvedValueOnce(TEST_TX_HASH);

    await withdraw(config, {
      account: SUB_ACCOUNT,
      isolationType: SubAccountIsolationType.MARKET,
      parts: PARTS,
      speedUp: true,
      providerData: "0x1234",
      chainId: 999,
    });

    expect(initiateWithdraw).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ speedUp: true, providerData: "0x1234", chainId: 999 }),
    );
  });
});
