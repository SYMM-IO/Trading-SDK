import { decodeFunctionData, encodeFunctionData, erc20Abi, zeroAddress, zeroHash, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId, getChainConfig } from "../../core/chains";
import { accountLayerAbi } from "../../symmio-contracts/abi/v0.8.6/account-layer";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { gaslessWalletAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-wallet";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { feeQuoteRevert, rawFeeQuote } from "../test/fee-quote";
import { getGaslessBatchFeeQuote } from "./get-gasless-batch-fee-quote";

const ADDRESSES = getChainConfig(GASLESS_TEST_CHAIN).addresses;
const ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const OWNER: Address = "0x1111111111111111111111111111111111111111";
const VIRTUAL_ACCOUNT: Address = "0x4444444444444444444444444444444444444444";
const WALLET: Address = "0x5555555555555555555555555555555555555555";
const USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const RECIPIENT: Address = "0x7777777777777777777777777777777777777777";

interface StubRead {
  functionName: string;
  args?: readonly unknown[];
}

type ReadContractMock = ReturnType<typeof gaslessTestConfig>["readContract"];

/** Answer the reads a batch quote performs; anything unexpected fails the test. */
function programReads(
  readContract: ReadContractMock,
  preview: () => Promise<unknown> = async () => rawFeeQuote(ACCOUNT),
) {
  readContract.mockImplementation((read: StubRead) => {
    switch (read.functionName) {
      case "previewFeeQuote":
        return preview();
      case "getVirtualAccount":
        return Promise.resolve({ accountAddress: ACCOUNT, parentAccount: ACCOUNT, symbolId: 0n, isExists: false });
      case "getSubAccount":
        return Promise.resolve({
          accountAddress: ACCOUNT,
          owner: OWNER,
          name: "Main",
          isExists: true,
          singleVAMode: false,
          affiliate: ACCOUNT,
          symmioCore: ACCOUNT,
        });
      case "getGaslessWalletAddress":
        return Promise.resolve(WALLET);
      default:
        return Promise.reject(new Error(`unprogrammed read: ${read.functionName}`));
    }
  });
}

/** The reads the stub served, in order. */
function reads(readContract: ReadContractMock): StubRead[] {
  return readContract.mock.calls.map(([read]) => read as StubRead);
}

/** The `previewFeeQuote` calldata the stub was asked to price. */
function previewedCallData(readContract: ReadContractMock): Hex {
  const preview = reads(readContract).find((read) => read.functionName === "previewFeeQuote");
  return preview!.args![0] as Hex;
}

/** The `relayInstantBatch` arguments the preview was asked to price. */
function quotedBatch(readContract: ReadContractMock) {
  const decoded = decodeFunctionData({ abi: gaslessLayerAbi, data: previewedCallData(readContract) });
  if (decoded.functionName !== "relayInstantBatch") throw new Error(`unexpected ${decoded.functionName}`);
  return decoded.args;
}

describe("getGaslessBatchFeeQuote", () => {
  it("prices relayable writes from placeholders alone — no nonce, owner or wallet reads", async () => {
    const { config, readContract } = gaslessTestConfig();
    programReads(readContract);

    const quote = await getGaslessBatchFeeQuote(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: ACCOUNT,
      calls: [
        { functionName: "allocate", args: [5n] },
        { functionName: "addMargin", args: [VIRTUAL_ACCOUNT, 7n] },
      ],
    });

    expect(quote.totalFee18).toBe(50_000_000_000_000_000n);
    expect(reads(readContract).map((read) => read.functionName)).toEqual(["previewFeeQuote"]);

    const [signedOps, signatures, , , walletIds] = quotedBatch(readContract);
    expect(signedOps.map((operation) => [operation.target, operation.callData])).toEqual([
      [ADDRESSES.symmioAddress, encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [5n] })],
      [
        ADDRESSES.accountLayerAddress,
        encodeFunctionData({ abi: accountLayerAbi, functionName: "addMargin", args: [VIRTUAL_ACCOUNT, 7n] }),
      ],
    ]);
    for (const operation of signedOps) {
      /** The preview never checks these, so they are fixed — the quote depends only on the account and calls. */
      expect(operation.signer).toBe(zeroAddress);
      expect(operation.signerAccount).toEqual({ addr: ACCOUNT, isPartyB: false });
      expect(operation.replayAttackHeader.deadline).toBe(0n);
      expect(operation.replayAttackHeader.salt).toBe(zeroHash);
    }
    expect(signatures).toHaveLength(2);
    expect(walletIds).toEqual([0n, 0n]);
  });

  it("targets the account owner's real wallet for a GaslessWallet entry", async () => {
    const { config, readContract } = gaslessTestConfig();
    programReads(readContract);

    await getGaslessBatchFeeQuote(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: ACCOUNT,
      calls: [
        { functionName: "allocate", args: [5n] },
        {
          walletId: 2n,
          walletCalls: [{ target: USDC, abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] }],
        },
      ],
    });

    /** The preview rejects any other target, so the owner is resolved the way the GaslessLayer resolves it. */
    expect(reads(readContract).find((read) => read.functionName === "getGaslessWalletAddress")?.args).toEqual([
      OWNER,
      2n,
    ]);

    const [signedOps, , , , walletIds] = quotedBatch(readContract);
    expect(signedOps[1]?.target).toBe(WALLET);
    expect(signedOps[1]?.signerAccount).toEqual({ addr: ACCOUNT, isPartyB: false });
    expect(decodeFunctionData({ abi: gaslessWalletAbi, data: signedOps[1]!.callData }).functionName).toBe("execute");
    expect(walletIds).toEqual([0n, 2n]);
  });

  it("prices the same calls with byte-identical calldata every time", async () => {
    const { config, readContract } = gaslessTestConfig();
    programReads(readContract);
    const parameters = {
      chainId: GASLESS_TEST_CHAIN,
      account: ACCOUNT,
      calls: [{ functionName: "allocate", args: [5n] }],
    };

    await getGaslessBatchFeeQuote(config, parameters);
    const first = previewedCallData(readContract);
    readContract.mockClear();
    await getGaslessBatchFeeQuote(config, parameters);

    expect(previewedCallData(readContract)).toBe(first);
  });

  it("refuses a write the relayer cannot carry before any read", async () => {
    const { config, readContract } = gaslessTestConfig();
    programReads(readContract);
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] });

    await expect(
      getGaslessBatchFeeQuote(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: ACCOUNT,
        calls: [{ data: transferData }],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_NOT_RELAYABLE" });
    expect(readContract).not.toHaveBeenCalled();
  });

  it("surfaces an exhausted free quota as the same typed error as getGaslessFeeQuote", async () => {
    const { config, readContract } = gaslessTestConfig();
    programReads(readContract, () => Promise.reject(feeQuoteRevert("DailyFreeOpsLimitExceeded", [ACCOUNT, 5n])));

    await expect(
      getGaslessBatchFeeQuote(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: ACCOUNT,
        calls: [{ functionName: "allocate", args: [5n] }],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_FREE_QUOTA_EXHAUSTED" });
  });

  it("throws GASLESS_NOT_CONFIGURED on a chain without a gasless deployment", async () => {
    const { config } = gaslessTestConfig();

    await expect(
      getGaslessBatchFeeQuote(config, {
        chainId: SymmioSupportedChainId.BASE,
        account: ACCOUNT,
        calls: [{ functionName: "allocate", args: [5n] }],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_NOT_CONFIGURED" });
  });
});
