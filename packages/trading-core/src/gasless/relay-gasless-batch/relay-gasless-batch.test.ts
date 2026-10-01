import {
  HttpRequestError,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  toFunctionSelector,
  type Address,
  type Hex,
} from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId, getChainConfig } from "../../core/chains";
import { gaslessWalletAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-wallet";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR } from "../constants";
import { GASLESS_RELAYABLE_WRITES } from "../relayable-writes";
import {
  GASLESS_TEST_CHAIN,
  TEST_GASLESS,
  TEST_GASLESS_SIGNATURE,
  TEST_GASLESS_SIGNER,
  gaslessWriteTestConfig,
} from "../test/config";
import { asReadContractError, feeQuoteRevert, rawFeeQuote } from "../test/fee-quote";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { relayGaslessBatch } from "./relay-gasless-batch";

const ADDRESSES = getChainConfig(GASLESS_TEST_CHAIN).addresses;
const SUB_ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const SESSION_KEY: Address = "0x5555555555555555555555555555555555555555";
const WALLET: Address = "0x6666666666666666666666666666666666666666";
const USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const RECIPIENT: Address = "0x7777777777777777777777777777777777777777";
const HEADERS = { "x-gaslessq-protocol-instance": TEST_GASLESS.protocolInstance };
const ACCEPTED = { request_id: "req-batch", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" };
const TRANSFER = { target: USDC, abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] } as const;

/** The selector of a relayable write, taken from the canonical SDK map (never hardcoded). */
function relayableSelector(operationType: string): Hex {
  for (const [selector, write] of GASLESS_RELAYABLE_WRITES) {
    if (write.operationType === operationType) return selector;
  }
  throw new Error(`no relayable write is labelled "${operationType}"`);
}

interface StubRead {
  functionName: string;
  args?: readonly unknown[];
}

type ReadContractMock = ReturnType<typeof gaslessWriteTestConfig>["readContract"];

/**
 * Program the public-client stub per contract function name. An override value
 * is returned as-is; an override **function** is called with the read.
 */
function programReads(readContract: ReadContractMock, overrides?: Partial<Record<string, unknown>>): void {
  readContract.mockImplementation((read: StubRead) => {
    const { functionName } = read;
    if (functionName in (overrides ?? {})) {
      const override = overrides![functionName];
      return typeof override === "function"
        ? Promise.resolve().then(() => (override as (read: StubRead) => unknown)(read))
        : Promise.resolve(override);
    }
    switch (functionName) {
      case "instantLayer":
        return Promise.resolve(ADDRESSES.instantLayerAddress);
      case "getSubAccount":
        return Promise.resolve({
          accountAddress: SUB_ACCOUNT,
          owner: TEST_GASLESS_SIGNER,
          name: "Main",
          isExists: true,
          singleVAMode: false,
          affiliate: SUB_ACCOUNT,
          symmioCore: SUB_ACCOUNT,
        });
      case "getVirtualAccount":
        return Promise.resolve({
          accountAddress: SUB_ACCOUNT,
          parentAccount: SUB_ACCOUNT,
          symbolId: 0n,
          isExists: false,
        });
      case "nonces":
        return Promise.resolve(5n);
      case "walletOperationNonces":
        return Promise.resolve(3n);
      case "getGaslessWalletAddress":
        return Promise.resolve(WALLET);
      case "previewFeeQuote":
        return Promise.resolve(rawFeeQuote(SUB_ACCOUNT));
      case "isDelegationActive":
        return Promise.resolve(true);
      default:
        return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
    }
  });
}

/** One EIP-712 prompt as the stub wallet received it. */
interface SignCall {
  domain: { name: string; verifyingContract: string };
  types: Record<string, unknown>;
  message: {
    signer: string;
    target: string;
    callData: Hex;
    signerAccount: { addr: string; isPartyB: boolean };
    replayAttackHeader: { nonce: bigint };
  };
}

/** The relay-instant body the SDK posted. */
interface PostedBody {
  userAddress: string;
  accountId: string;
  operationType: string;
  signedOps: { target: string; flexFields: unknown[]; maxUses: number; replayAttackHeader: { nonce: number } }[];
  signatures: string[];
  walletIds: string[];
  fills: unknown[][];
  flexFillerSignatures: unknown[][];
  metadata?: Record<string, unknown>;
}

function postedBody(): PostedBody {
  return post.mock.calls[0]?.[1] as PostedBody;
}

describe("relayGaslessBatch", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ headers: HEADERS, data: ACCEPTED });
  });

  it("relays several writes as one request, on sequential InstantLayer nonces", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig();
    programReads(readContract);

    const receipt = await relayGaslessBatch(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: SUB_ACCOUNT,
      calls: [
        {
          functionName: "approveOperationalFeeWithMultiplier",
          args: [[TEST_GASLESS.gaslessLayerAddress], [1_000_000_000_000_000_000n], [10_000n]],
        },
        { abi: symmioAbi, functionName: "allocate", args: [5n] },
      ],
    });

    expect(receipt).toMatchObject({ requestId: "req-batch", owner: TEST_GASLESS_SIGNER, walletIds: [0n, 0n] });

    /** One InstantLayer prompt per write, counting up from the consumed nonce. */
    const prompts = signTypedData.mock.calls.map(([call]) => call as SignCall);
    expect(prompts.map((prompt) => prompt.domain.name)).toEqual(["SymmioInstantLayer", "SymmioInstantLayer"]);
    expect(prompts[0]?.domain.verifyingContract).toBe(ADDRESSES.instantLayerAddress);
    expect(prompts.map((prompt) => prompt.message.replayAttackHeader.nonce)).toEqual([6n, 7n]);
    expect(prompts.map((prompt) => prompt.message.target)).toEqual([ADDRESSES.symmioAddress, ADDRESSES.symmioAddress]);

    /** One request carries both, with an explicit wallet 0 for each. */
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toBe("/gateway/relay-instant");
    expect(post.mock.calls[0]?.[2]).toMatchObject({
      baseURL: `${TEST_GASLESS.url}/v1/instances/${TEST_GASLESS.protocolInstance}/operations`,
    });
    const body = postedBody();
    expect(body).toMatchObject({
      userAddress: TEST_GASLESS_SIGNER,
      accountId: SUB_ACCOUNT,
      operationType: "approveOperationalFee+allocate",
      walletIds: ["0", "0"],
      signatures: [TEST_GASLESS_SIGNATURE, TEST_GASLESS_SIGNATURE],
      fills: [[], []],
      flexFillerSignatures: [[], []],
    });
    expect(body.signedOps.map((operation) => operation.replayAttackHeader.nonce)).toEqual([6, 7]);

    /** The fee is previewed before the first prompt. */
    const previewCall = readContract.mock.calls.findIndex(
      ([read]) => (read as StubRead).functionName === "previewFeeQuote",
    );
    expect(readContract.mock.invocationCallOrder[previewCall]).toBeLessThan(signTypedData.mock.invocationCallOrder[0]!);
  });

  it("mixes a GaslessWallet entry into the same request, signed under the gateway domain", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig();
    programReads(readContract);

    const receipt = await relayGaslessBatch(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: SUB_ACCOUNT,
      calls: [
        { functionName: "allocate", args: [5n] },
        { walletId: 2n, walletCalls: [TRANSFER] },
      ],
    });

    const [instant, wallet] = signTypedData.mock.calls.map(([call]) => call as SignCall);
    expect(instant?.domain.name).toBe("SymmioInstantLayer");
    expect(instant?.message.replayAttackHeader.nonce).toBe(6n);

    /** The wallet entry: the five-field gateway struct, the wallet as target, its own nonce stream. */
    expect(wallet?.domain).toMatchObject({
      name: "GaslessGateway",
      verifyingContract: TEST_GASLESS.gaslessLayerAddress,
    });
    expect(Object.keys(wallet!.types)).not.toContain("FlexField");
    expect(wallet?.message).not.toHaveProperty("flexFields");
    expect(wallet?.message.target).toBe(WALLET);
    expect(wallet?.message.signerAccount).toEqual({ addr: SUB_ACCOUNT, isPartyB: false });
    expect(wallet?.message.replayAttackHeader.nonce).toBe(4n);
    expect(decodeFunctionData({ abi: gaslessWalletAbi, data: wallet!.message.callData }).functionName).toBe("execute");

    const walletNonceRead = readContract.mock.calls
      .map(([read]) => read as StubRead)
      .find((read) => read.functionName === "walletOperationNonces");
    expect(walletNonceRead?.args).toEqual([TEST_GASLESS_SIGNER, 2n, SUB_ACCOUNT]);

    const body = postedBody();
    expect(body.walletIds).toEqual(["0", "2"]);
    expect(body.operationType).toBe("allocate+gaslessqWalletExecute");
    expect(body.signedOps[1]).toMatchObject({ target: WALLET, flexFields: [], maxUses: 1 });
    expect(receipt.walletIds).toEqual([0n, 2n]);
  });

  it("refuses a write the relayer cannot carry before any read or prompt", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig();
    programReads(readContract);
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [RECIPIENT, 1n] });

    await expect(
      relayGaslessBatch(config, { chainId: GASLESS_TEST_CHAIN, account: SUB_ACCOUNT, calls: [{ data: transferData }] }),
    ).rejects.toMatchObject({ code: "GASLESS_NOT_RELAYABLE" });
    expect(readContract).not.toHaveBeenCalled();
    expect(signTypedData).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("stops a session key that lacks a delegation before any prompt, naming what to grant", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
      signersByFrom: { [SESSION_KEY]: SESSION_KEY },
    });
    const allocate = relayableSelector("allocate");
    const transfer = toFunctionSelector("transfer(address,uint256)");
    programReads(readContract, {
      isDelegationActive: (read: StubRead) => read.args?.[2] !== allocate && read.args?.[2] !== transfer,
    });

    const failure = relayGaslessBatch(config, {
      chainId: GASLESS_TEST_CHAIN,
      from: SESSION_KEY,
      account: SUB_ACCOUNT,
      calls: [{ functionName: "allocate", args: [5n] }, { walletCalls: [TRANSFER] }],
    });

    await expect(failure).rejects.toMatchObject({ code: "GASLESS_SIGNER_NOT_DELEGATED" });
    await expect(failure).rejects.toThrow(new RegExp(`${allocate}.*${transfer}`));
    expect(signTypedData).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();

    /** The wallet entry needs the sentinel too, checked on the canonical account. */
    const probed = readContract.mock.calls
      .map(([read]) => read as StubRead)
      .filter((read) => read.functionName === "isDelegationActive")
      .map((read) => read.args);
    expect(probed).toContainEqual([SUB_ACCOUNT, SESSION_KEY, GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR]);
  });

  it("stops before any prompt when the fee quote refuses the batch", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig();
    programReads(readContract, {
      previewFeeQuote: () => {
        throw feeQuoteRevert("DailyFreeOpsLimitExceeded", [SUB_ACCOUNT, 5n]);
      },
    });

    await expect(
      relayGaslessBatch(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: SUB_ACCOUNT,
        calls: [{ functionName: "allocate", args: [5n] }],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_FREE_QUOTA_EXHAUSTED" });
    expect(signTypedData).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("signs through a fee quote that failed for transport reasons — the relayer simulates anyway", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig();
    programReads(readContract, {
      previewFeeQuote: () => {
        throw asReadContractError(new HttpRequestError({ url: "https://rpc.invalid" }));
      },
    });

    await relayGaslessBatch(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: SUB_ACCOUNT,
      calls: [{ functionName: "allocate", args: [5n] }],
    });
    expect(signTypedData).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("forwards an explicit label and metadata", async () => {
    const { config, readContract } = gaslessWriteTestConfig();
    programReads(readContract);

    await relayGaslessBatch(config, {
      chainId: GASLESS_TEST_CHAIN,
      account: SUB_ACCOUNT,
      calls: [{ functionName: "allocate", args: [5n] }],
      operationType: "onboarding",
      metadata: { source: "test" },
    });

    expect(postedBody()).toMatchObject({ operationType: "onboarding", metadata: { source: "test" } });
  });

  it("throws GASLESS_NOT_CONFIGURED on a chain without a gasless deployment", async () => {
    const { config, signTypedData } = gaslessWriteTestConfig();

    await expect(
      relayGaslessBatch(config, {
        chainId: SymmioSupportedChainId.BASE,
        account: SUB_ACCOUNT,
        calls: [{ functionName: "allocate", args: [5n] }],
      }),
    ).rejects.toMatchObject({ code: "GASLESS_NOT_CONFIGURED" });
    expect(signTypedData).not.toHaveBeenCalled();
  });
});
