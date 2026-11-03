import { decodeFunctionData, type Address, type Hex, type PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import type { Config } from "../../../core/config";
import { gaslessWriteTestConfig, TEST_GASLESS_SIGNER } from "../../../gasless/test/config";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("axios", () => ({ default: { post, get }, isAxiosError: () => false }));

import { executeAccountCalls } from "./execute-account-calls";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const ARBITRUM = getChainConfig(CHAIN);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RELAYED_HASH = `0x${"ee".repeat(32)}` as const;
const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-test" };

/** Two relayable core writes, in the order they must run. */
const CALLS = [
  { functionName: "allocate", args: [5n] },
  { functionName: "requestCancelWithdraw", args: [7n] },
];

function setup() {
  const base = gaslessWriteTestConfig({ execution: { preflightFee: false } });
  const simulateContract = vi.fn().mockResolvedValue({ result: undefined });
  const config: Config = {
    ...base.config,
    getClient: () => ({ ...base.config.getClient(), simulateContract }) as unknown as PublicClient,
  };
  base.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (functionName === "instantLayer") return ARBITRUM.addresses.instantLayerAddress;
    if (functionName === "getSubAccount") return { owner: TEST_GASLESS_SIGNER, isExists: true };
    if (functionName === "getVirtualAccount") return { isExists: false };
    if (functionName === "nonces") return 1n;
    throw new Error(`Unexpected read: ${functionName}`);
  });
  post.mockResolvedValue({ headers: HEADERS, data: { request_id: "account-calls-1", status: "queued" } });
  get.mockResolvedValue({
    headers: HEADERS,
    data: { id: "account-calls-1", status: "submitted", tx_hash: RELAYED_HASH, payload: {} },
  });
  return { ...base, config };
}

describe("executeAccountCalls — gasless path", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("relays every call, in order, as one request against the SYMMIO core, without the wallet", async () => {
    const { config, writeContract } = setup();

    await expect(
      executeAccountCalls(config, { chainId: CHAIN, account: SUB_ACCOUNT, calls: CALLS, gasless: true }),
    ).resolves.toBe(RELAYED_HASH);

    expect(writeContract).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
    const parameters = post.mock.calls[0]![1];
    expect(parameters.accountId).toBe(SUB_ACCOUNT);
    expect(parameters.signedOps).toHaveLength(CALLS.length);
    const relayed = parameters.signedOps.map((op: { target: Address; callData: Hex }) => ({
      target: op.target,
      functionName: decodeFunctionData({ abi: symmioAbi, data: op.callData }).functionName,
    }));
    expect(relayed).toEqual(
      CALLS.map((call) => ({ target: ARBITRUM.addresses.symmioAddress, functionName: call.functionName })),
    );
  });

  it("refuses a demanded relay of a write the service cannot relay, instead of sending it from the wallet", async () => {
    const { config, writeContract } = setup();

    await expect(
      executeAccountCalls(config, {
        chainId: CHAIN,
        account: SUB_ACCOUNT,
        calls: [...CALLS, { functionName: "depositFor", args: [SUB_ACCOUNT, 1n] }],
        gasless: true,
      }),
    ).rejects.toMatchObject({ code: "GASLESS_NOT_RELAYABLE" });

    expect(writeContract).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
