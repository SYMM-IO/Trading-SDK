import {
  HttpRequestError,
  createWalletClient,
  custom,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  recoverTypedDataAddress,
  toFunctionSelector,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId, getChainConfig } from "../../core/chains";
import { gaslessWalletAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-wallet";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { getGaslessBatchSelectors, type GaslessBatchCall } from "../batch/calls";
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
      case "ownerOf":
        return Promise.resolve(TEST_GASLESS_SIGNER);
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

  describe("caller-owned idempotency key", () => {
    const CALLS = [{ functionName: "allocate", args: [5n] }] as const;

    it("sends the key, and answers a same-key retry with the accepted receipt instead of more prompts", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig();
      programReads(readContract);
      const batch = { chainId: GASLESS_TEST_CHAIN, account: SUB_ACCOUNT, calls: CALLS, idempotencyKey: "onboard-1" };

      const first = await relayGaslessBatch(config, batch);
      const retry = await relayGaslessBatch(config, batch);

      expect(postedBody()).toMatchObject({ idempotencyKey: "onboard-1" });
      expect(first.idempotencyKey).toBe("onboard-1");
      expect(retry).toEqual(first);
      expect(signTypedData).toHaveBeenCalledOnce();
      expect(post).toHaveBeenCalledOnce();
    });

    it("signs again under a different key — a different action — after the first is accepted", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig();
      programReads(readContract);

      await relayGaslessBatch(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: SUB_ACCOUNT,
        calls: CALLS,
        idempotencyKey: "onboard-1",
      });
      /** The first request's nonce is now on-chain, so the second action signs past it. */
      programReads(readContract, { nonces: 6n });
      await relayGaslessBatch(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: SUB_ACCOUNT,
        calls: CALLS,
        idempotencyKey: "onboard-2",
      });

      expect(signTypedData).toHaveBeenCalledTimes(2);
      expect(post.mock.calls.map(([, body]) => (body as { idempotencyKey: string }).idempotencyKey)).toEqual([
        "onboard-1",
        "onboard-2",
      ]);
    });

    it("rejects an invalid key before any read or prompt", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig();
      programReads(readContract);

      await expect(
        relayGaslessBatch(config, {
          chainId: GASLESS_TEST_CHAIN,
          account: SUB_ACCOUNT,
          calls: CALLS,
          idempotencyKey: " ",
        }),
      ).rejects.toMatchObject({ code: "GASLESS_IDEMPOTENCY_KEY_INVALID" });
      expect(readContract).not.toHaveBeenCalled();
      expect(signTypedData).not.toHaveBeenCalled();
    });
  });

  describe("mixed signers", () => {
    const GATEWAY = TEST_GASLESS.gaslessLayerAddress;
    const KEY_SIGNATURE = `0x${"ab".repeat(65)}` as Hex;

    /** The address each EIP-712 prompt was signed by, in the order the prompts ran. */
    function promptSigners(signTypedData: ReturnType<typeof gaslessWriteTestConfig>["signTypedData"]): string[] {
      return signTypedData.mock.calls.map(([call]) => (call as { account: { address: string } }).account.address);
    }

    /** The one-signature onboarding shape: the owner grants the key, which spends the grant later in the batch. */
    function onboardingCalls(grantedSelectors: readonly Hex[]) {
      return [
        {
          functionName: "grantDelegations",
          args: [
            [
              {
                account: { addr: SUB_ACCOUNT, isPartyB: false },
                delegatedSigner: SESSION_KEY,
                selectors: grantedSelectors,
                expiryTimestamp: 4_000_000_000n,
              },
            ],
          ],
        },
        { functionName: "approveOperationalFee", args: [[GATEWAY], [1n]], from: SESSION_KEY },
      ] as const;
    }

    it("submits real owner and session signatures under their respective signing domains", async () => {
      // Public fixture keys; the HTTP client and all chain reads are mocked.
      const owner = privateKeyToAccount(`0x${"11".repeat(32)}`);
      const key = privateKeyToAccount(`0x${"22".repeat(32)}`);
      const transport = custom({
        request: async () => {
          throw new Error("Unexpected wallet RPC");
        },
      });
      const ownerClient = createWalletClient({ account: owner, chain: arbitrum, transport });
      const keyClient = createWalletClient({ account: key, chain: arbitrum, transport });
      const ownerSign = vi.spyOn(ownerClient, "signTypedData");
      const keySign = vi.spyOn(keyClient, "signTypedData");
      const { config, readContract } = gaslessWriteTestConfig();
      programReads(readContract, {
        ownerOf: owner.address,
        getSubAccount: {
          accountAddress: SUB_ACCOUNT,
          owner: owner.address,
          name: "Main",
          isExists: true,
          singleVAMode: false,
          affiliate: SUB_ACCOUNT,
          symmioCore: SUB_ACCOUNT,
        },
        isDelegationActive: false,
      });
      const walletCall = { from: key.address, walletId: 2n, walletCalls: [TRANSFER] };
      await relayGaslessBatch(
        {
          ...config,
          getWalletClient: async (parameters) => {
            if (parameters?.from === owner.address) return ownerClient;
            if (parameters?.from === key.address) return keyClient;
            throw new Error("No default wallet");
          },
        },
        {
          account: SUB_ACCOUNT,
          calls: [
            {
              from: owner.address,
              functionName: "grantDelegation",
              args: [
                {
                  account: { addr: SUB_ACCOUNT, isPartyB: false },
                  delegatedSigner: key.address,
                  selectors: getGaslessBatchSelectors([walletCall]),
                  expiryTimestamp: 4_000_000_000n,
                },
              ],
            },
            walletCall,
          ],
        },
      );
      const body = postedBody();
      const ownerData = ownerSign.mock.calls[0]![0];
      const keyData = keySign.mock.calls[0]![0];
      expect(ownerData.domain).toMatchObject({
        name: "SymmioInstantLayer",
        verifyingContract: ADDRESSES.instantLayerAddress,
      });
      expect(keyData.domain).toMatchObject({ name: "GaslessGateway", verifyingContract: GATEWAY });
      expect(await recoverTypedDataAddress({ ...ownerData, signature: body.signatures[0] as Hex })).toBe(owner.address);
      expect(await recoverTypedDataAddress({ ...keyData, signature: body.signatures[1] as Hex })).toBe(key.address);
      expect(body.signedOps).toMatchObject([{ signer: owner.address }, { signer: key.address }]);
      expect(body.userAddress).toBe(owner.address);
    });

    it.each([
      ["named", { functionName: "allocate", args: [5n], from: SESSION_KEY }],
      [
        "raw",
        { data: encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [5n] }), from: SESSION_KEY },
      ],
      ["wallet", { walletId: 2n, walletCalls: [TRANSFER], from: SESSION_KEY }],
    ] satisfies [string, GaslessBatchCall][])(
      "routes an explicit %s signer ahead of the batch signer",
      async (_, call) => {
        const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
          signersByFrom: { [SESSION_KEY]: SESSION_KEY },
        });
        programReads(readContract);
        await relayGaslessBatch(config, {
          account: SUB_ACCOUNT,
          from: TEST_GASLESS_SIGNER,
          calls: [call, { functionName: "allocate", args: [1n] }],
        });
        expect(promptSigners(signTypedData)).toEqual([SESSION_KEY, TEST_GASLESS_SIGNER]);
        expect(postedBody().signedOps).toMatchObject([{ signer: SESSION_KEY }, { signer: TEST_GASLESS_SIGNER }]);
        expect((signTypedData.mock.calls[0]![0] as SignCall).domain.name).toBe(
          "walletCalls" in call ? "GaslessGateway" : "SymmioInstantLayer",
        );
      },
    );

    it("inherits the batch signer for wallet entries and resolves each requested signer once", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
        signersByFrom: { [SESSION_KEY]: SESSION_KEY },
      });
      programReads(readContract);
      const getWalletClient = vi.fn(config.getWalletClient);
      await relayGaslessBatch(
        { ...config, getWalletClient },
        {
          account: SUB_ACCOUNT,
          from: SESSION_KEY,
          calls: [{ walletCalls: [TRANSFER] }, { functionName: "allocate", args: [1n], from: SESSION_KEY }],
        },
      );
      expect(getWalletClient).toHaveBeenCalledExactlyOnceWith({ chainId: GASLESS_TEST_CHAIN, from: SESSION_KEY });
      expect(promptSigners(signTypedData)).toEqual([SESSION_KEY, SESSION_KEY]);
    });

    it("uses a preceding owner grant for a session-signed wallet entry without resolving a default wallet", async () => {
      const { config, readContract, signTypedData, getBlock } = gaslessWriteTestConfig(undefined, {
        signersByFrom: { [SESSION_KEY]: SESSION_KEY },
        localSigners: [SESSION_KEY],
      });
      programReads(readContract, { isDelegationActive: false });
      const walletCall = { walletId: 2n, walletCalls: [TRANSFER], from: SESSION_KEY };
      const [grant] = onboardingCalls(getGaslessBatchSelectors([walletCall]));
      const getWalletClient = vi.fn(async (parameters: Parameters<typeof config.getWalletClient>[0]) => {
        if (!parameters?.from) throw new Error("No default wallet is connected");
        return config.getWalletClient(parameters);
      });
      await relayGaslessBatch(
        { ...config, getWalletClient },
        {
          account: SUB_ACCOUNT,
          calls: [{ ...grant, from: TEST_GASLESS_SIGNER }, walletCall],
        },
      );
      expect(getWalletClient.mock.calls.map(([parameters]) => parameters?.from)).toEqual([
        TEST_GASLESS_SIGNER,
        SESSION_KEY,
      ]);
      expect(promptSigners(signTypedData)).toEqual([SESSION_KEY, TEST_GASLESS_SIGNER]);
      expect(postedBody().signedOps).toMatchObject([
        {
          signer: TEST_GASLESS_SIGNER,
          flexFields: [],
          maxUses: 1,
          signerAccount: { addr: SUB_ACCOUNT, isPartyB: false },
        },
        { signer: SESSION_KEY, target: WALLET },
      ]);
      expect(getBlock).toHaveBeenCalledExactlyOnceWith({ blockTag: "latest" });
      expect(readContract.mock.calls.some(([read]) => (read as StubRead).functionName === "isDelegationActive")).toBe(
        false,
      );
    });

    it("rejects a delegate-signed grant before collecting any signatures", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
        signersByFrom: { [SESSION_KEY]: SESSION_KEY },
      });
      programReads(readContract);
      const [grant] = onboardingCalls([relayableSelector("allocate")]);
      await expect(
        relayGaslessBatch(config, {
          account: SUB_ACCOUNT,
          calls: [{ ...grant, from: SESSION_KEY }],
        }),
      ).rejects.toMatchObject({ code: "GASLESS_INVALID_DELEGATION_GRANT" });
      expect(signTypedData).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    });

    it("keeps delegation preflight optional while preserving per-entry signer routing", async () => {
      const { config, readContract, signTypedData, getBlock } = gaslessWriteTestConfig(
        { execution: { preflightDelegation: false } },
        {
          signersByFrom: { [SESSION_KEY]: SESSION_KEY },
        },
      );
      programReads(readContract, { isDelegationActive: false });
      await relayGaslessBatch(config, {
        account: SUB_ACCOUNT,
        calls: [
          { functionName: "allocate", args: [1n] },
          { walletCalls: [TRANSFER], from: SESSION_KEY },
        ],
      });
      expect(promptSigners(signTypedData)).toEqual([TEST_GASLESS_SIGNER, SESSION_KEY]);
      expect(getBlock).not.toHaveBeenCalled();
      expect(
        readContract.mock.calls.some(([read]) =>
          ["isDelegationActive", "ownerOf"].includes((read as StubRead).functionName),
        ),
      ).toBe(false);
    });

    it("signs each call with its own `from` and writes that signer into its operation", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
        signersByFrom: { [SESSION_KEY]: SESSION_KEY },
      });
      programReads(readContract);

      await relayGaslessBatch(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: SUB_ACCOUNT,
        calls: [
          { functionName: "allocate", args: [5n] },
          { functionName: "approveOperationalFee", args: [[GATEWAY], [1n]], from: SESSION_KEY },
        ],
      });

      expect(promptSigners(signTypedData)).toEqual([TEST_GASLESS_SIGNER, SESSION_KEY]);
      const operations = postedBody().signedOps as unknown as {
        signer: string;
        replayAttackHeader: { nonce: number };
      }[];
      expect(operations.map((operation) => operation.signer)).toEqual([TEST_GASLESS_SIGNER, SESSION_KEY]);
      /** Both run under the one account, so they share its InstantLayer nonce stream. */
      expect(operations.map((operation) => operation.replayAttackHeader.nonce)).toEqual([6, 7]);
    });

    it("lets a key sign a call that an owner-signed grant earlier in the batch authorizes", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
        signersByFrom: { [SESSION_KEY]: SESSION_KEY },
      });
      /** Nothing is delegated on-chain yet: only the in-batch grant can authorize the key. */
      programReads(readContract, { isDelegationActive: false });

      await relayGaslessBatch(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: SUB_ACCOUNT,
        calls: onboardingCalls([relayableSelector("approveOperationalFeeAllowance")]),
      });

      expect(signTypedData).toHaveBeenCalledTimes(2);
      expect(post).toHaveBeenCalledTimes(1);
      expect(postedBody().operationType).toBe("grantDelegations+approveOperationalFeeAllowance");
    });

    it("still stops a key whose call the in-batch grant does not cover, naming that key", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
        signersByFrom: { [SESSION_KEY]: SESSION_KEY },
      });
      programReads(readContract, { isDelegationActive: false });
      const approve = relayableSelector("approveOperationalFeeAllowance");

      const failure = relayGaslessBatch(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: SUB_ACCOUNT,
        calls: onboardingCalls([relayableSelector("allocate")]),
      });

      await expect(failure).rejects.toMatchObject({ code: "GASLESS_SIGNER_NOT_DELEGATED" });
      await expect(failure).rejects.toThrow(new RegExp(`${SESSION_KEY}.*${approve}`));
      expect(signTypedData).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    });

    it("does not count a grant that comes after the call it would authorize", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
        signersByFrom: { [SESSION_KEY]: SESSION_KEY },
      });
      programReads(readContract, { isDelegationActive: false });
      const [grant, approve] = onboardingCalls([relayableSelector("approveOperationalFeeAllowance")]);

      await expect(
        relayGaslessBatch(config, { chainId: GASLESS_TEST_CHAIN, account: SUB_ACCOUNT, calls: [approve, grant] }),
      ).rejects.toMatchObject({ code: "GASLESS_SIGNER_NOT_DELEGATED" });
      expect(signTypedData).not.toHaveBeenCalled();
    });

    it("signs in-memory keys before the wallet prompt, keeping signatures in relay order", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(undefined, {
        signersByFrom: { [SESSION_KEY]: SESSION_KEY },
        localSigners: [SESSION_KEY],
      });
      programReads(readContract, { isDelegationActive: false });
      signTypedData.mockImplementation(async (call: { account: { address: string } }) =>
        call.account.address === SESSION_KEY ? KEY_SIGNATURE : TEST_GASLESS_SIGNATURE,
      );

      await relayGaslessBatch(config, {
        chainId: GASLESS_TEST_CHAIN,
        account: SUB_ACCOUNT,
        calls: onboardingCalls([relayableSelector("approveOperationalFeeAllowance")]),
      });

      expect(promptSigners(signTypedData)).toEqual([SESSION_KEY, TEST_GASLESS_SIGNER]);
      expect(postedBody().signatures).toEqual([TEST_GASLESS_SIGNATURE, KEY_SIGNATURE]);
    });
  });
});
