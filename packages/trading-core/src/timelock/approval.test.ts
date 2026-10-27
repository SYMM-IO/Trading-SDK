import axios from "axios";
import { decodeFunctionData, keccak256, type Address, type Hex } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { SymmApiError } from "../shared/errors/symm-error";
import { mockConfig, TEST_TYPED_SIGNATURE, TEST_USER } from "../shared/test/mock-config";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import {
  createHttpTimelockApprovalProvider,
  encodeTimelockedCoreCall,
  prepareTimelockApprovalRequest,
  requestTimelockApproval,
  requestTimelockApprovalMutationOptions,
  type TimelockApprovalCapability,
  type TimelockApprovalResponse,
} from "./approval";

const ACCOUNT: Address = "0x2222222222222222222222222222222222222222";
const ROOT: Address = "0x3333333333333333333333333333333333333333";
const UNLOCKER: Address = "0x4444444444444444444444444444444444444444";
const CALL_DATA: Hex = "0x12345678aabb";
const SALT: Hex = `0x${"11".repeat(32)}`;
const APPROVAL_HASH: Hex = `0x${"22".repeat(32)}`;

function capability(config: ReturnType<typeof mockConfig>["config"]): TimelockApprovalCapability {
  const chain = config.getChainConfig(SymmioSupportedChainId.ARBITRUM);
  return {
    unlocker: UNLOCKER,
    validitySeconds: 60,
    minTimelockDelaySeconds: 600,
    requestDomain: {
      name: "SymmioTimelockApprovalRequest",
      version: "1",
      chainId: String(chain.chainId),
      verifyingContract: chain.addresses.accountLayerAddress,
    },
  };
}

function rig() {
  const result = mockConfig();
  const getBlock = vi.fn().mockResolvedValue({ timestamp: 1_900_000_000n });
  Object.assign(result.config.getClient({ chainId: SymmioSupportedChainId.ARBITRUM }), { getBlock });
  return { ...result, getBlock };
}

function approvalResponse(): TimelockApprovalResponse {
  return {
    account: ROOT,
    unlocker: UNLOCKER,
    call_data_hash: keccak256(CALL_DATA),
    deadline: "1900000060",
    salt: SALT,
    signature: TEST_TYPED_SIGNATURE,
    approval_hash: APPROVAL_HASH,
    remaining_approvals: 2,
  };
}

function approvalParameters(
  config: ReturnType<typeof mockConfig>["config"],
  provider: { requestApproval: () => Promise<TimelockApprovalResponse> },
) {
  return {
    account: ACCOUNT,
    rootAccount: ROOT,
    callData: CALL_DATA,
    capability: capability(config),
    deadline: 1_900_000_300n,
    provider,
  };
}

describe("timelock approval workflow", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["0x", "0x1234", `0x${"12".repeat(64)}`, `0x${"ab".repeat(128)}`] as Hex[])(
    "preserves arbitrary EIP-1271 signature bytes %s without claiming cryptographic validity",
    async (signature) => {
      const { config, writeContract } = rig();
      const response = { ...approvalResponse(), signature };
      const provider = { requestApproval: vi.fn().mockResolvedValue(response) };
      const result = await requestTimelockApproval(config, approvalParameters(config, provider));
      expect(result.signedApproval.signature).toBe(signature);
      expect(provider.requestApproval).toHaveBeenCalledOnce();
      expect(writeContract).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, 12, "1234", "0x123", "0xzz"])(
    "rejects malformed signature bytes %s retaining the response",
    async (signature) => {
      const { config } = rig();
      const response = { ...approvalResponse(), signature };
      const provider = { requestApproval: vi.fn().mockResolvedValue(response) };
      await expect(requestTimelockApproval(config, approvalParameters(config, provider))).rejects.toMatchObject({
        code: "TIMELOCK_APPROVAL_RESPONSE_MISMATCH",
        responseData: response,
      });
      expect(provider.requestApproval).toHaveBeenCalledOnce();
    },
  );

  it.each([-120, 120])("accepts a chain-valid approval with device clock skew of %s seconds", async (skew) => {
    vi.spyOn(Date, "now").mockReturnValue((1_900_000_000 + skew) * 1000);
    const { config } = rig();
    const response = approvalResponse();
    const provider = { requestApproval: vi.fn().mockResolvedValue(response) };
    const result = await requestTimelockApproval(config, approvalParameters(config, provider));
    expect(result.signedApproval.approval.deadline).toBe(1_900_000_060n);
    expect(result.signedApproval.signature).toBe(response.signature);
    expect(provider.requestApproval).toHaveBeenCalledOnce();
  });

  it.each([1_900_000_060n, 1_900_000_061n])(
    "retains an approval expired at chain time %s even with a slow device clock",
    async (timestamp) => {
      vi.spyOn(Date, "now").mockReturnValue(1_899_999_880_000);
      const { config, getBlock } = rig();
      getBlock
        .mockResolvedValueOnce({ timestamp: 1_900_000_000n })
        .mockResolvedValueOnce({ timestamp: 1_900_000_000n })
        .mockResolvedValue({ timestamp });
      const response = approvalResponse();
      const provider = { requestApproval: vi.fn().mockResolvedValue(response) };
      await expect(requestTimelockApproval(config, approvalParameters(config, provider))).rejects.toMatchObject({
        code: "TIMELOCK_APPROVAL_RESPONSE_MISMATCH",
        responseData: response,
      });
      expect(provider.requestApproval).toHaveBeenCalledOnce();
    },
  );

  it("retains the issued response if reading chain time fails without requesting another approval", async () => {
    const { config, getBlock } = rig();
    const rpcError = new Error("RPC unavailable");
    getBlock
      .mockResolvedValueOnce({ timestamp: 1_900_000_000n })
      .mockResolvedValueOnce({ timestamp: 1_900_000_000n })
      .mockRejectedValue(rpcError);
    const response = approvalResponse();
    const provider = { requestApproval: vi.fn().mockResolvedValue(response) };
    await expect(requestTimelockApproval(config, approvalParameters(config, provider))).rejects.toMatchObject({
      code: "TIMELOCK_APPROVAL_TIME_UNAVAILABLE",
      responseData: response,
      cause: rpcError,
    });
    expect(provider.requestApproval).toHaveBeenCalledOnce();
  });

  it("disables mutation retries even when an application has retry defaults", () => {
    const { config } = rig();
    expect(requestTimelockApprovalMutationOptions(config).retry).toBe(false);
  });

  it("preserves provider status, code, body, and retry timing on HTTP errors", async () => {
    const responseBody = { code: 3705, error_category: "rate_limit", error_message: "Approval budget exhausted" };
    const client = axios.create();
    vi.spyOn(client, "post").mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 429",
      response: {
        status: 429,
        statusText: "Too Many Requests",
        data: responseBody,
        headers: { "retry-after": "2" },
      },
    });
    const provider = createHttpTimelockApprovalProvider({
      baseUrl: "https://solver.example/",
      client,
    });
    const { config } = rig();
    const prepared = await prepareTimelockApprovalRequest(config, {
      account: ACCOUNT,
      callData: CALL_DATA,
      capability: capability(config),
      deadline: 1_900_000_300n,
      salt: SALT,
    });

    const failure = await provider.requestApproval(prepared.request).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SymmApiError);
    expect(failure).toMatchObject({
      kind: "api",
      code: "3705",
      status: 429,
      responseData: responseBody,
      retryAfterMs: 2_000,
      method: "POST",
      url: "https://solver.example/timelock-approval",
    });
  });

  it("signs the raw Core calldata using the provider request domain", async () => {
    const { config, signTypedData } = rig();
    const prepared = await prepareTimelockApprovalRequest(config, {
      chainId: SymmioSupportedChainId.ARBITRUM,
      account: ACCOUNT,
      callData: CALL_DATA,
      capability: capability(config),
      deadline: 1_900_000_300n,
      salt: SALT,
    });

    expect(prepared.request.signature).toBe(TEST_TYPED_SIGNATURE);
    expect(prepared.request.signedOperation.callData).toBe(CALL_DATA);
    expect(prepared.request.signedOperation.signerAccount).toEqual({ addr: ACCOUNT, isPartyB: false });
    expect(prepared.request.signedOperation.maxUses).toBe("1");
    expect(prepared.request.signedOperation.replayAttackHeader).toMatchObject({
      nonce: "0",
      deadline: "1900000300",
      salt: SALT,
    });
    expect(signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({ address: TEST_USER }),
        domain: expect.objectContaining({ name: "SymmioTimelockApprovalRequest" }),
        primaryType: "SignedOperation",
      }),
    );
  });

  it("requests once and validates account, unlocker, and calldata hash", async () => {
    const { config, getBlock } = rig();
    const provider = {
      requestApproval: vi.fn().mockResolvedValue({
        account: ROOT,
        unlocker: UNLOCKER,
        call_data_hash: keccak256(CALL_DATA),
        deadline: "1900000060",
        salt: SALT,
        signature: TEST_TYPED_SIGNATURE,
        approval_hash: APPROVAL_HASH,
        remaining_approvals: 2,
      }),
    };
    const result = await requestTimelockApproval(config, {
      chainId: SymmioSupportedChainId.ARBITRUM,
      account: ACCOUNT,
      rootAccount: ROOT,
      callData: CALL_DATA,
      capability: capability(config),
      deadline: 1_900_000_300n,
      salt: SALT,
      provider,
    });

    expect(provider.requestApproval).toHaveBeenCalledOnce();
    expect(getBlock).toHaveBeenCalledTimes(3);
    expect(result.signedApproval.approval).toMatchObject({
      account: ROOT,
      unlocker: UNLOCKER,
      callDataHash: keccak256(CALL_DATA),
      deadline: 1_900_000_060n,
    });
  });

  it("rejects a provider response for different calldata", async () => {
    const { config } = rig();
    const provider = {
      requestApproval: vi.fn().mockResolvedValue({
        account: ROOT,
        unlocker: UNLOCKER,
        call_data_hash: `0x${"00".repeat(32)}`,
        deadline: 1_900_000_060,
        salt: SALT,
        signature: TEST_TYPED_SIGNATURE,
        approval_hash: APPROVAL_HASH,
        remaining_approvals: 2,
      }),
    };
    await expect(
      requestTimelockApproval(config, {
        account: ACCOUNT,
        rootAccount: ROOT,
        callData: CALL_DATA,
        capability: capability(config),
        deadline: 1_900_000_300n,
        provider,
      }),
    ).rejects.toMatchObject({ code: "TIMELOCK_APPROVAL_RESPONSE_MISMATCH" });
    expect(provider.requestApproval).toHaveBeenCalledOnce();
  });

  it("wraps Core calldata in AccountLayer _call without changing it", () => {
    const wrapped = encodeTimelockedCoreCall(ACCOUNT, CALL_DATA);
    expect(decodeFunctionData({ abi: accountLayerAbi, data: wrapped })).toEqual({
      functionName: "_call",
      args: [ACCOUNT, [CALL_DATA]],
    });
  });
  it("does not request an approval if signing consumed the request deadline", async () => {
    const { config, getBlock, signTypedData } = rig();
    getBlock.mockResolvedValueOnce({ timestamp: 1_900_000_000n }).mockResolvedValue({ timestamp: 1_900_000_300n });
    const provider = { requestApproval: vi.fn() };
    await expect(
      requestTimelockApproval(config, {
        account: ACCOUNT,
        rootAccount: ROOT,
        callData: CALL_DATA,
        capability: capability(config),
        deadline: 1_900_000_300n,
        provider,
      }),
    ).rejects.toMatchObject({ code: "TIMELOCK_APPROVAL_REQUEST_DEADLINE_INVALID" });
    expect(signTypedData).toHaveBeenCalledOnce();
    expect(provider.requestApproval).not.toHaveBeenCalled();
  });
  it.each([0, undefined, 3703, 3704])("never accepts error response code %s as an approval", async (code) => {
    const { config } = rig();
    const provider = {
      requestApproval: vi.fn().mockResolvedValue({ code, error_category: "account_state", error_message: "Denied" }),
    };
    await expect(
      requestTimelockApproval(config, {
        account: ACCOUNT,
        rootAccount: ROOT,
        callData: CALL_DATA,
        capability: capability(config),
        deadline: 1_900_000_300n,
        provider,
      }),
    ).rejects.toMatchObject({
      details: { code: code ?? null, errorCategory: "account_state", errorMessage: "Denied" },
    });
    expect(provider.requestApproval).toHaveBeenCalledOnce();
  });
});
