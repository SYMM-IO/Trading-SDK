import { decodeFunctionData, encodeFunctionData, erc20Abi, type Address, type Hex } from "viem";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR, gaslessWalletAbi } from "../gateway/gasless-layer-abi";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, TEST_GASLESS_SIGNER, gaslessWriteTestConfig } from "../test/config";

const post = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

import { gaslessWalletExecute } from "./gasless-wallet-execute";
import { getGaslessWalletExecuteSelectors } from "./selectors";

const WALLET = "0x5555555555555555555555555555555555555555" as const;
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-vibe" };

describe("gaslessWalletExecute", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("signs the 5-field gateway-domain struct and ships transport-only flexFields/maxUses", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig();
    readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getGaslessWalletAddress") return Promise.resolve(WALLET);
      if (functionName === "walletOperationNonces") return Promise.resolve(4n);
      return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
    });
    post.mockResolvedValue({
      headers: HEADERS,
      data: { request_id: "req-w1", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" },
    });

    const receipt = await gaslessWalletExecute(config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [{ target: USDC, value: 0n, data: "0xa9059cbb" }],
    });

    expect(receipt.requestId).toBe("req-w1");

    /** Signature: gateway domain, 5-field type table, wallet as target, nonce + 1. */
    const signCall = signTypedData.mock.calls[0]?.[0] as {
      domain: { name: string; verifyingContract: string };
      types: Record<string, unknown>;
      primaryType: string;
      message: {
        target: string;
        signerAccount: { addr: string };
        replayAttackHeader: { nonce: bigint };
        callData: `0x${string}`;
      };
    };
    expect(signCall.domain.name).toBe("GaslessGateway");
    expect(signCall.domain.verifyingContract).toBe(TEST_GASLESS.gaslessLayerAddress);
    expect(signCall.primaryType).toBe("SignedOperation");
    expect(Object.keys(signCall.types)).not.toContain("FlexField");
    expect(signCall.message.target).toBe(WALLET);
    expect(signCall.message.signerAccount.addr).toBe(TEST_GASLESS_SIGNER);
    expect(signCall.message.replayAttackHeader.nonce).toBe(5n);

    const inner = decodeFunctionData({ abi: gaslessWalletAbi, data: signCall.message.callData });
    expect(inner.functionName).toBe("execute");

    /** Transport: numbers + the unsigned flexFields/maxUses fields. */
    const body = post.mock.calls[0]?.[1] as {
      operationType: string;
      signedOps: { flexFields: unknown[]; maxUses: number; replayAttackHeader: { nonce: number } }[];
    };
    expect(body.operationType).toBe("gaslessqWalletExecute");
    expect(body.signedOps[0]?.flexFields).toEqual([]);
    expect(body.signedOps[0]?.maxUses).toBe(1);
    expect(body.signedOps[0]?.replayAttackHeader.nonce).toBe(5);
  });

  it("refuses a zero wallet address from an unwired gateway", async () => {
    const { config, readContract } = gaslessWriteTestConfig();
    readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getGaslessWalletAddress")
        return Promise.resolve("0x0000000000000000000000000000000000000000");
      if (functionName === "walletOperationNonces") return Promise.resolve(0n);
      return Promise.reject(new Error("unprogrammed"));
    });

    await expect(
      gaslessWalletExecute(config, {
        chainId: GASLESS_TEST_CHAIN,
        calls: [{ target: USDC, value: 0n, data: "0xa9059cbb" }],
      }),
    ).rejects.toThrowError(/GASLESS_WALLET_UNAVAILABLE|zero address/);
    expect(post).not.toHaveBeenCalled();
  });
});

const ROUTER = "0x9999999999999999999999999999999999999999" as const;
const AMOUNT = 1_000_000n;

/** Happy-path rig: a wired gateway and a relay that accepts. */
function walletExecuteRig() {
  const rig = gaslessWriteTestConfig();
  rig.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
    if (functionName === "getGaslessWalletAddress") return Promise.resolve(WALLET);
    if (functionName === "walletOperationNonces") return Promise.resolve(4n);
    return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
  });
  post.mockResolvedValue({
    headers: HEADERS,
    data: { request_id: "req-w1", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" },
  });
  return rig;
}

/** The `(address,uint256,bytes)[]` batch the wallet was actually asked to run. */
function innerCallsOf(signTypedData: Mock): readonly { target: Address; value: bigint; data: Hex }[] {
  const signCall = signTypedData.mock.calls[0]?.[0] as { message: { callData: Hex } };
  return decodeFunctionData({ abi: gaslessWalletAbi, data: signCall.message.callData }).args[0];
}

describe("gaslessWalletExecute call forms", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("encodes an ABI-level call to the same calldata as its raw twin", async () => {
    const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ROUTER, AMOUNT] });

    const abiForm = walletExecuteRig();
    await gaslessWalletExecute(abiForm.config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [{ target: USDC, abi: erc20Abi, functionName: "approve", args: [ROUTER, AMOUNT] }],
    });

    post.mockReset();
    const rawForm = walletExecuteRig();
    await gaslessWalletExecute(rawForm.config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [{ target: USDC, value: 0n, data: approveData }],
    });

    expect(innerCallsOf(abiForm.signTypedData)).toEqual(innerCallsOf(rawForm.signTypedData));
    expect(innerCallsOf(abiForm.signTypedData)[0]?.data).toBe(approveData);
  });

  it("defaults an omitted `value` to 0n in both call forms", async () => {
    const { config, signTypedData } = walletExecuteRig();

    await gaslessWalletExecute(config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [
        { target: USDC, data: "0xa9059cbb" },
        { target: ROUTER, abi: erc20Abi, functionName: "approve", args: [ROUTER, AMOUNT] },
      ],
    });

    expect(innerCallsOf(signTypedData).map((call) => call.value)).toEqual([0n, 0n]);
  });

  it("preserves order across a mixed raw + ABI batch", async () => {
    const { config, signTypedData } = walletExecuteRig();

    await gaslessWalletExecute(config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [
        { target: USDC, abi: erc20Abi, functionName: "approve", args: [ROUTER, AMOUNT] },
        { target: ROUTER, data: "0xdeadbeef" },
      ],
    });

    expect(innerCallsOf(signTypedData).map((call) => call.target)).toEqual([USDC, ROUTER]);
    expect(innerCallsOf(signTypedData)[1]?.data).toBe("0xdeadbeef");
  });

  it("labels the request `gaslessqWalletExecute` by default and honours an override", async () => {
    const base = walletExecuteRig();
    await gaslessWalletExecute(base.config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [{ target: USDC, data: "0xa9059cbb" }],
    });
    expect((post.mock.calls[0]?.[1] as { operationType: string }).operationType).toBe("gaslessqWalletExecute");

    post.mockReset();
    const labelled = walletExecuteRig();
    await gaslessWalletExecute(labelled.config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [{ target: USDC, data: "0xa9059cbb" }],
      operationType: "bridgeWithdraw",
    });
    expect((post.mock.calls[0]?.[1] as { operationType: string }).operationType).toBe("bridgeWithdraw");
  });

  it("throws on a malformed ABI call before signing or submitting", async () => {
    const { config, signTypedData } = walletExecuteRig();

    await expect(
      gaslessWalletExecute(config, {
        chainId: GASLESS_TEST_CHAIN,
        /** `approve` takes two arguments — one is an encoding error, not a relay error. */
        calls: [{ target: USDC, abi: erc20Abi, functionName: "approve", args: [ROUTER] }],
      }),
    ).rejects.toThrowError();

    expect(signTypedData).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});

const SUB_ACCOUNT = "0x77777777777777777777777777777777777777aa" as const;
const SESSION_KEY = "0x8888888888888888888888888888888888888888" as const;

/**
 * Rig for a delegated (session-key) execution: `from: SESSION_KEY` resolves to a
 * client signing as the key, the AccountLayer reports TEST_GASLESS_SIGNER as the
 * sub-account's owner, and `isDelegationActive` answers from `granted`.
 */
function delegatedRig(granted: readonly string[]) {
  const rig = gaslessWriteTestConfig(undefined, { signersByFrom: { [SESSION_KEY]: SESSION_KEY } });
  const delegationProbes: string[] = [];

  rig.readContract.mockImplementation(({ functionName, args }: { functionName: string; args: readonly unknown[] }) => {
    if (functionName === "getGaslessWalletAddress") return Promise.resolve(WALLET);
    if (functionName === "walletOperationNonces") return Promise.resolve(9n);
    if (functionName === "getVirtualAccount") return Promise.resolve({ parentAccount: SUB_ACCOUNT, isExists: false });
    if (functionName === "getSubAccount") return Promise.resolve({ isExists: true, owner: TEST_GASLESS_SIGNER });
    if (functionName === "isDelegationActive") {
      const selector = String(args[2]).toLowerCase();
      delegationProbes.push(selector);
      return Promise.resolve(granted.includes(selector));
    }
    return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
  });
  post.mockResolvedValue({
    headers: HEADERS,
    data: { request_id: "req-w2", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" },
  });

  return { ...rig, delegationProbes };
}

const TRANSFER_CALL = { target: USDC, abi: erc20Abi, functionName: "transfer", args: [SESSION_KEY, 1n] } as const;

describe("gaslessWalletExecute signerAccount + session keys", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("keeps the owner path free of account-resolution and delegation reads", async () => {
    const { config, readContract } = walletExecuteRig();

    await gaslessWalletExecute(config, {
      chainId: GASLESS_TEST_CHAIN,
      calls: [{ target: USDC, data: "0xa9059cbb" }],
    });

    const probed = readContract.mock.calls.map((call) => (call[0] as { functionName: string }).functionName);
    expect(probed).not.toContain("getVirtualAccount");
    expect(probed).not.toContain("getSubAccount");
    expect(probed).not.toContain("isDelegationActive");
  });

  it("signs a sub-account operation against the owner's wallet, keyed on the sub-account", async () => {
    const required = getGaslessWalletExecuteSelectors([TRANSFER_CALL]);
    const { config, signTypedData, readContract } = delegatedRig(required);

    await gaslessWalletExecute(config, {
      chainId: GASLESS_TEST_CHAIN,
      from: SESSION_KEY,
      signerAccount: SUB_ACCOUNT,
      calls: [TRANSFER_CALL],
    });

    const signCall = signTypedData.mock.calls[0]?.[0] as {
      message: {
        signer: string;
        target: string;
        signerAccount: { addr: string };
        replayAttackHeader: { nonce: bigint };
      };
    };
    /** The key signs, but authority and the nonce belong to the sub-account. */
    expect(signCall.message.signer).toBe(SESSION_KEY);
    expect(signCall.message.signerAccount.addr).toBe(SUB_ACCOUNT);
    expect(signCall.message.replayAttackHeader.nonce).toBe(10n);

    /** The wallet is still derived from the owner, so the address is unchanged. */
    expect(signCall.message.target).toBe(WALLET);
    const walletRead = readContract.mock.calls
      .map((call) => call[0] as { functionName: string; args: readonly unknown[] })
      .find((call) => call.functionName === "getGaslessWalletAddress");
    expect(walletRead?.args[0]).toBe(TEST_GASLESS_SIGNER);

    const nonceRead = readContract.mock.calls
      .map((call) => call[0] as { functionName: string; args: readonly unknown[] })
      .find((call) => call.functionName === "walletOperationNonces");
    expect(nonceRead?.args[0]).toBe(SUB_ACCOUNT);
  });

  it("checks the sentinel and every inner selector against the canonical account", async () => {
    const required = getGaslessWalletExecuteSelectors([TRANSFER_CALL]);
    const { config, delegationProbes, readContract } = delegatedRig(required);

    await gaslessWalletExecute(config, {
      chainId: GASLESS_TEST_CHAIN,
      from: SESSION_KEY,
      signerAccount: SUB_ACCOUNT,
      calls: [TRANSFER_CALL],
    });

    expect([...delegationProbes].sort()).toEqual([...required].sort());
    const probe = readContract.mock.calls
      .map((call) => call[0] as { functionName: string; args: readonly unknown[] })
      .find((call) => call.functionName === "isDelegationActive");
    expect(probe?.args[0]).toBe(SUB_ACCOUNT);
    expect(probe?.args[1]).toBe(SESSION_KEY);
  });

  it("refuses before signing when the wallet-execution sentinel is not granted", async () => {
    const inner = getGaslessWalletExecuteSelectors([TRANSFER_CALL]).slice(1);
    const { config, signTypedData } = delegatedRig(inner);

    await expect(
      gaslessWalletExecute(config, {
        chainId: GASLESS_TEST_CHAIN,
        from: SESSION_KEY,
        signerAccount: SUB_ACCOUNT,
        calls: [TRANSFER_CALL],
      }),
    ).rejects.toThrowError(/GASLESS_SIGNER_NOT_DELEGATED|holds no delegation/);

    expect(signTypedData).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses when only the sentinel is granted — inner selectors are checked too", async () => {
    const { config, signTypedData } = delegatedRig([GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR]);

    await expect(
      gaslessWalletExecute(config, {
        chainId: GASLESS_TEST_CHAIN,
        from: SESSION_KEY,
        signerAccount: SUB_ACCOUNT,
        calls: [TRANSFER_CALL],
      }),
    ).rejects.toThrowError(/holds no delegation/);

    expect(signTypedData).not.toHaveBeenCalled();
  });
});
