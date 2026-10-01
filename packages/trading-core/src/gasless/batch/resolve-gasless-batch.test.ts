import { decodeFunctionData, encodeFunctionData, erc20Abi, zeroHash, type Address, type Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getChainConfig } from "../../core/chains";
import { gaslessWalletAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-wallet";
import { GASLESS_TEST_CHAIN } from "../test/config";
import {
  buildGaslessBatchOperations,
  defaultGaslessBatchOperationType,
  distinctGaslessBatchWalletIds,
  resolveGaslessBatchEntries,
  type ResolvedGaslessBatchEntry,
} from "./resolve-gasless-batch";

const ADDRESSES = getChainConfig(GASLESS_TEST_CHAIN).addresses;
const ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const VIRTUAL_ACCOUNT: Address = "0x4444444444444444444444444444444444444444";
const SIGNER: Address = "0x1111111111111111111111111111111111111111";
const USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const RECIPIENT: Address = "0x7777777777777777777777777777777777777777";
const WALLET_0: Address = "0x5555555555555555555555555555555555555555";
const WALLET_2: Address = "0x6666666666666666666666666666666666666666";
const DELEGATION = {
  account: { addr: ACCOUNT, isPartyB: false },
  delegatedSigner: SIGNER,
  selectors: ["0x12345678"] as Hex[],
  expiryTimestamp: 1_800_000_000n,
};
const TRANSFER = { target: USDC, abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] } as const;

describe("resolveGaslessBatchEntries", () => {
  it("resolves each relayable write to the contract that declares it", () => {
    const entries = resolveGaslessBatchEntries(ADDRESSES, [
      { functionName: "allocate", args: [5n] },
      { functionName: "addMargin", args: [VIRTUAL_ACCOUNT, 7n] },
      { functionName: "grantDelegation", args: [DELEGATION] },
    ]);

    expect(entries.map((entry) => entry.type === "instant" && [entry.target, entry.operationType])).toEqual([
      [ADDRESSES.symmioAddress, "allocate"],
      [ADDRESSES.accountLayerAddress, "addMargin"],
      [ADDRESSES.instantLayerAddress, "grantDelegation"],
    ]);
  });

  it("encodes a GaslessWallet entry as one execute call, on wallet 0 unless it names another", () => {
    const [entry, other] = resolveGaslessBatchEntries(ADDRESSES, [
      { walletCalls: [TRANSFER] },
      { walletId: 2n, walletCalls: [TRANSFER, { target: USDC, data: "0xa9059cbb" }] },
    ]);

    expect(entry).toMatchObject({ type: "wallet", walletId: 0n });
    expect(other).toMatchObject({ type: "wallet", walletId: 2n });
    const decoded = decodeFunctionData({ abi: gaslessWalletAbi, data: other!.callData });
    expect(decoded.functionName).toBe("execute");
    expect(decoded.args[0]).toEqual([
      {
        target: USDC,
        value: 0n,
        data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] }),
      },
      { target: USDC, value: 0n, data: "0xa9059cbb" },
    ]);
  });

  it("rejects an empty batch, a write the relayer cannot carry, and an invalid wallet id", () => {
    expect(() => resolveGaslessBatchEntries(ADDRESSES, [])).toThrow(
      expect.objectContaining({ code: "GASLESS_EMPTY_BATCH" }),
    );

    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] });
    expect(() =>
      resolveGaslessBatchEntries(ADDRESSES, [{ functionName: "allocate", args: [5n] }, { data: transferData }]),
    ).toThrow(expect.objectContaining({ code: "GASLESS_NOT_RELAYABLE", message: expect.stringContaining("calls[1]") }));
    expect(() => resolveGaslessBatchEntries(ADDRESSES, [{ data: "0x" }])).toThrow(
      expect.objectContaining({ code: "GASLESS_NOT_RELAYABLE" }),
    );

    expect(() => resolveGaslessBatchEntries(ADDRESSES, [{ walletId: -1n, walletCalls: [TRANSFER] }])).toThrow(
      expect.objectContaining({ code: "GASLESS_WALLET_ID_INVALID" }),
    );
  });
});

describe("defaultGaslessBatchOperationType", () => {
  it("joins the entries' own labels, and falls back once they exceed the service's 128 characters", () => {
    const entries = resolveGaslessBatchEntries(ADDRESSES, [
      { functionName: "allocate", args: [5n] },
      { walletCalls: [TRANSFER] },
    ]);
    expect(defaultGaslessBatchOperationType(entries)).toBe("allocate+gaslessqWalletExecute");

    const many = resolveGaslessBatchEntries(
      ADDRESSES,
      Array.from({ length: 20 }, () => ({ functionName: "allocate", args: [5n] })),
    );
    expect(defaultGaslessBatchOperationType(many)).toBe("gaslessBatch");
  });
});

describe("buildGaslessBatchOperations", () => {
  const entries: ResolvedGaslessBatchEntry[] = resolveGaslessBatchEntries(ADDRESSES, [
    { functionName: "allocate", args: [1n] },
    { walletId: 2n, walletCalls: [TRANSFER] },
    { functionName: "allocate", args: [2n] },
    { walletId: 2n, walletCalls: [TRANSFER] },
    { walletCalls: [TRANSFER] },
  ]);

  it("counts each stream up on its own: InstantLayer writes on the account, wallet entries per wallet id", () => {
    const salt = vi.fn(() => zeroHash);
    const built = buildGaslessBatchOperations(entries, {
      signer: SIGNER,
      account: ACCOUNT,
      deadline: 1_900_000_000n,
      instantNonce: 5n,
      walletTargets: new Map([
        [0n, WALLET_0],
        [2n, WALLET_2],
      ]),
      walletNonces: new Map([[2n, 9n]]),
      salt,
    });

    expect(built.operations.map((operation) => operation.replayAttackHeader.nonce)).toEqual([6n, 10n, 7n, 11n, 1n]);
    expect(built.operations.map((operation) => operation.target)).toEqual([
      ADDRESSES.symmioAddress,
      WALLET_2,
      ADDRESSES.symmioAddress,
      WALLET_2,
      WALLET_0,
    ]);
    expect(built.walletIds).toEqual([0n, 2n, 0n, 2n, 0n]);
    expect(built.lastInstantNonce).toBe(7n);
    expect(built.lastWalletNonces).toEqual(
      new Map([
        [2n, 11n],
        [0n, 1n],
      ]),
    );

    /** Every operation runs under the batch's account, signed by the one signer, with no flex fields. */
    for (const operation of built.operations) {
      expect(operation.signer).toBe(SIGNER);
      expect(operation.signerAccount).toEqual({ addr: ACCOUNT, isPartyB: false });
      expect(operation.flexFields).toEqual([]);
      expect(operation.maxUses).toBe(1n);
      expect(operation.replayAttackHeader.deadline).toBe(1_900_000_000n);
    }
    expect(salt).toHaveBeenCalledTimes(5);
    expect(distinctGaslessBatchWalletIds(entries)).toEqual([2n, 0n]);
  });

  it("reports no InstantLayer nonce for a batch without relayable writes", () => {
    const built = buildGaslessBatchOperations(entries.slice(4), {
      signer: SIGNER,
      account: ACCOUNT,
      deadline: 0n,
      instantNonce: 0n,
      walletTargets: new Map([[0n, WALLET_0]]),
      walletNonces: new Map(),
      salt: () => zeroHash,
    });
    expect(built.lastInstantNonce).toBeNull();
  });

  it("fails loudly when a wallet's address was never resolved", () => {
    expect(() =>
      buildGaslessBatchOperations(entries, {
        signer: SIGNER,
        account: ACCOUNT,
        deadline: 0n,
        instantNonce: 0n,
        walletTargets: new Map(),
        walletNonces: new Map(),
        salt: () => zeroHash,
      }),
    ).toThrow(/wallet id 2/);
  });
});
