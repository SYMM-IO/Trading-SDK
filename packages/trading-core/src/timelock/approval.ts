import axios, { isAxiosError, type AxiosInstance } from "axios";
import {
  encodeFunctionData,
  isAddress,
  isAddressEqual,
  isHex,
  keccak256,
  size,
  type Address,
  type Hex,
  type TypedDataDomain,
} from "viem";
import type { Config } from "../core/config";
import { parseRetryAfterMs } from "../shared/errors/retry-after";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import { readHttpHeader } from "../shared/utils/http-header";
import { SIGNED_OPERATION_TYPES, signSignedOperation } from "../solvers/instant-open/shared/eip712";
import { buildSignedOperation, generateSalt } from "../solvers/instant-open/shared/operations";
import type { SignedOperation } from "../solvers/instant-open/shared/types";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import type { SignedTimelockApproval } from "../symmio-contracts/account-layer/types";
import { TimelockSolverError } from "./errors";

/** Solver-advertised, deployment-specific public timelock capability. */
export interface TimelockApprovalCapability {
  unlocker: Address;
  validitySeconds: number;
  minTimelockDelaySeconds: number;
  requestDomain: {
    name: "SymmioTimelockApprovalRequest";
    version: "1";
    chainId: number | string;
    verifyingContract: Address;
  };
}

/** Stable request body accepted by a compatible timelock-approval provider. */
export interface TimelockApprovalRequestPayload {
  signedOperation: {
    signer: Address;
    target: Address;
    callData: Hex;
    signerAccount: { addr: Address; isPartyB: false };
    flexFields: [];
    maxUses: string;
    replayAttackHeader: { nonce: string; deadline: string; salt: Hex };
  };
  signature: Hex;
}

/** Raw success response defined by the public timelock-approval API. */
export interface TimelockApprovalResponse {
  account: Address;
  unlocker: Address;
  call_data_hash: Hex;
  deadline: number | string;
  salt: Hex;
  signature: Hex;
  approval_hash: Hex;
  remaining_approvals: number;
}

/**
 * Transport seam for a public-approval service. The SDK never assumes a solver
 * vendor, URL, authentication mechanism, or retry policy.
 *
 * Implementations MUST issue one request only. An ambiguous result must be
 * surfaced to the caller because repeating the POST creates another approval.
 */
export interface TimelockApprovalProvider {
  requestApproval(
    request: TimelockApprovalRequestPayload,
    options?: { signal?: AbortSignal },
  ): Promise<TimelockApprovalResponse>;
}

/** HTTP failure from a standard `/timelock-approval` provider. */
export class TimelockApprovalHttpError extends TimelockSolverError {
  override readonly name = "TimelockApprovalHttpError";
  readonly responseBody: unknown;
  constructor(
    status: number,
    responseBody: unknown,
    options: { url: string; statusText: string; retryAfterMs: number | null },
  ) {
    const body = record(responseBody);
    const providerCode = body?.code;
    const providerMessage = body?.error_message;
    const code =
      typeof providerCode === "number" || typeof providerCode === "string"
        ? String(providerCode)
        : "TIMELOCK_APPROVAL_HTTP_ERROR";
    super({
      code,
      message:
        typeof providerMessage === "string" ? providerMessage : `Timelock approval request failed with HTTP ${status}.`,
      status,
      statusText: options.statusText,
      responseData: responseBody,
      url: options.url,
      method: "POST",
      retryAfterMs: options.retryAfterMs,
    });
    this.responseBody = responseBody;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Create a provider for the standard public endpoint. It performs exactly one
 * POST and never retries; callers own ambiguous-outcome recovery.
 */
export function createHttpTimelockApprovalProvider(parameters: {
  baseUrl: string;
  client?: AxiosInstance;
  headers?: Readonly<Record<string, string>>;
}): TimelockApprovalProvider {
  const client = parameters.client ?? axios;
  return {
    async requestApproval(request, options) {
      const url = `${parameters.baseUrl.replace(/\/$/, "")}/timelock-approval`;
      try {
        const response = await client.post<TimelockApprovalResponse>(url, request, {
          headers: { "Content-Type": "application/json", ...parameters.headers },
          signal: options?.signal,
        });
        return response.data;
      } catch (error) {
        if (!isAxiosError(error)) throw error;
        throw new TimelockApprovalHttpError(error.response?.status ?? 0, error.response?.data, {
          url,
          statusText: error.response?.statusText ?? "Unknown",
          retryAfterMs: parseRetryAfterMs(readHttpHeader(error.response?.headers, "retry-after")),
        });
      }
    },
  };
}

/** Raw operation and deployment domain to sign for one public approval request. */
export interface PrepareTimelockApprovalRequestParameters {
  chainId?: number;
  /** Account the raw Core call executes for; may be a VA. */
  account: Address;
  /** Canonical raw Core calldata, never its hash or the AccountLayer `_call` wrapper. */
  callData: Hex;
  capability: TimelockApprovalCapability;
  /** Unix-seconds API request deadline. Must be in the future and at most one hour ahead. */
  deadline: bigint;
  from?: Address;
  salt?: Hex;
}

/** Immutable signed request; preparing does not contact the approval provider. */
export interface PreparedTimelockApprovalRequest {
  operation: SignedOperation;
  request: TimelockApprovalRequestPayload;
}

/** One approval attempt, including expected root and a caller-selected transport. */
export interface RequestTimelockApprovalParameters extends PrepareTimelockApprovalRequestParameters {
  provider: TimelockApprovalProvider;
  /** Expected root account. Response validation rejects a different account. */
  rootAccount: Address;
  signal?: AbortSignal;
}

/** Verified response bound to the exact requested account, provider and calldata. */
export interface ValidatedTimelockApproval {
  signedApproval: SignedTimelockApproval;
  approvalHash: Hex;
  remainingApprovals: number;
  request: PreparedTimelockApprovalRequest;
}

/** Build AccountLayer `_call(account, [rawCoreCallData])` for timelock execution. */
export function encodeTimelockedCoreCall(account: Address, callData: Hex): Hex {
  return encodeFunctionData({
    abi: accountLayerAbi,
    functionName: "_call",
    args: [account, [callData]],
  });
}

/**
 * Build and sign an immutable public-approval request. Persist the returned
 * object before transport if the application needs recovery after a timeout.
 */
export async function prepareTimelockApprovalRequest(
  config: Config,
  parameters: PrepareTimelockApprovalRequestParameters,
): Promise<PreparedTimelockApprovalRequest> {
  const chain = config.getChainConfig(parameters.chainId);
  const domainChainId = Number(parameters.capability.requestDomain.chainId);
  if (
    parameters.capability.requestDomain.name !== "SymmioTimelockApprovalRequest" ||
    parameters.capability.requestDomain.version !== "1" ||
    domainChainId !== chain.chainId ||
    !isAddressEqual(parameters.capability.requestDomain.verifyingContract, chain.addresses.accountLayerAddress)
  ) {
    throw new SymmError(
      "validation",
      "TIMELOCK_APPROVAL_DOMAIN_MISMATCH",
      "Timelock approval capability does not match the selected chain and AccountLayer.",
    );
  }
  const block = await config.getClient({ chainId: chain.chainId }).getBlock({ blockTag: "latest" });
  if (parameters.deadline <= block.timestamp || parameters.deadline > block.timestamp + 3600n) {
    throw new SymmError(
      "validation",
      "TIMELOCK_APPROVAL_REQUEST_DEADLINE_INVALID",
      "Timelock approval request deadline must be in the future and no more than one hour ahead.",
    );
  }

  const wallet = await config.getWalletClient({ chainId: chain.chainId, from: parameters.from });
  if (wallet.chain?.id !== domainChainId)
    throw new SymmError(
      "validation",
      "TIMELOCK_WALLET_CHAIN_MISMATCH",
      "Switch the signing wallet to the approval request chain.",
    );
  const operation = buildSignedOperation({
    signer: wallet.account.address,
    target: chain.addresses.accountLayerAddress,
    callData: parameters.callData,
    signerAccount: parameters.account,
    deadline: parameters.deadline,
    nonce: 0n,
    salt: parameters.salt ?? generateSalt(),
    flexFields: [],
    maxUses: 1n,
  });
  const domain: TypedDataDomain = {
    name: parameters.capability.requestDomain.name,
    version: parameters.capability.requestDomain.version,
    chainId: domainChainId,
    verifyingContract: parameters.capability.requestDomain.verifyingContract,
  };
  const signature = await signSignedOperation(operation, domain, wallet);
  const afterSigning = await config.getClient({ chainId: chain.chainId }).getBlock({ blockTag: "latest" });
  if (parameters.deadline <= afterSigning.timestamp || parameters.deadline > afterSigning.timestamp + 3600n) {
    throw new SymmError(
      "validation",
      "TIMELOCK_APPROVAL_REQUEST_DEADLINE_INVALID",
      "The request expired while signing. No approval was requested.",
    );
  }
  return {
    operation,
    request: {
      signedOperation: {
        signer: operation.signer,
        target: operation.target,
        callData: operation.callData,
        signerAccount: { addr: operation.signerAccount.addr, isPartyB: false },
        flexFields: [],
        maxUses: operation.maxUses.toString(),
        replayAttackHeader: {
          nonce: operation.replayAttackHeader.nonce.toString(),
          deadline: operation.replayAttackHeader.deadline.toString(),
          salt: operation.replayAttackHeader.salt,
        },
      },
      signature,
    },
  };
}

/**
 * Request exactly one approval and validate the security-critical response.
 * Expiry uses the selected chain's latest block, not the device clock.
 * Response validation failures retain the untrusted response in `SymmApiError.responseData`.
 * This function deliberately has no automatic retry, including after a chain-time read failure.
 */
export async function requestTimelockApproval(
  config: Config,
  parameters: RequestTimelockApprovalParameters,
): Promise<ValidatedTimelockApproval> {
  const prepared = await prepareTimelockApprovalRequest(config, parameters);
  const response = await parameters.provider.requestApproval(prepared.request, { signal: parameters.signal });
  if (!record(response))
    throw approvalResponseError(
      response,
      "TIMELOCK_APPROVAL_RESPONSE_MISMATCH",
      "The provider returned no valid approval.",
    );
  if ("code" in response || "error_code" in response || "error_category" in response || "error_message" in response) {
    throw new TimelockSolverError({
      code: "TIMELOCK_APPROVAL_INVALID_RESPONSE",
      message: "No approval returned.",
      status: 200,
      statusText: "OK",
      responseData: response,
      url: "",
      method: "POST",
    });
  }
  const expectedHash = keccak256(parameters.callData);
  const validHex = (value: unknown, bytes: number): value is Hex =>
    typeof value === "string" && isHex(value) && size(value) === bytes;
  let approvalDeadline: bigint;
  try {
    approvalDeadline = BigInt(response.deadline);
  } catch {
    approvalDeadline = 0n;
  }
  if (
    !isAddress(response.account, { strict: false }) ||
    !isAddress(response.unlocker, { strict: false }) ||
    !validHex(response.call_data_hash, 32) ||
    !validHex(response.salt, 32) ||
    !validHex(response.signature, 65) ||
    !validHex(response.approval_hash, 32) ||
    !Number.isSafeInteger(response.remaining_approvals) ||
    response.remaining_approvals < 0 ||
    approvalDeadline <= 0n ||
    !isAddressEqual(response.account, parameters.rootAccount) ||
    !isAddressEqual(response.unlocker, parameters.capability.unlocker) ||
    response.call_data_hash.toLowerCase() !== expectedHash.toLowerCase()
  ) {
    throw approvalResponseError(
      response,
      "TIMELOCK_APPROVAL_RESPONSE_MISMATCH",
      "Timelock approval response does not match the requested root account, unlocker, or calldata.",
    );
  }
  let now: bigint;
  try {
    const block = await config
      .getClient({ chainId: Number(parameters.capability.requestDomain.chainId) })
      .getBlock({ blockTag: "latest" });
    now = block.timestamp;
  } catch (cause) {
    throw approvalResponseError(
      response,
      "TIMELOCK_APPROVAL_TIME_UNAVAILABLE",
      "Approval was returned but chain time could not be checked. Retain the response and reconcile before retrying.",
      cause,
    );
  }
  if (approvalDeadline <= now) {
    throw approvalResponseError(
      response,
      "TIMELOCK_APPROVAL_RESPONSE_MISMATCH",
      "The returned timelock approval has expired according to chain time. Reconcile before requesting another approval.",
    );
  }
  return {
    signedApproval: {
      approval: {
        account: response.account,
        unlocker: response.unlocker,
        callDataHash: response.call_data_hash,
        deadline: approvalDeadline,
        salt: response.salt,
      },
      signature: response.signature,
    },
    approvalHash: response.approval_hash,
    remainingApprovals: response.remaining_approvals,
    request: prepared,
  };
}

function approvalResponseError(response: unknown, code: string, message: string, cause?: unknown): SymmApiError {
  return new SymmApiError({
    code,
    message,
    // Custom providers do not expose HTTP metadata. Do not invent a status or URL.
    status: 0,
    statusText: "Unknown",
    url: "",
    method: "POST",
    responseData: response,
    cause:
      cause === undefined ? undefined : cause instanceof Error ? cause : new Error("Chain time read failed", { cause }),
  });
}

/**
 * TanStack mutation options with retries forcibly disabled. A QueryClient-wide
 * retry default must never duplicate approval issuance after an unknown POST.
 */
export function requestTimelockApprovalMutationOptions(config: Config) {
  return {
    mutationKey: ["requestTimelockApproval"] as const,
    mutationFn: (variables: RequestTimelockApprovalParameters) => requestTimelockApproval(config, variables),
    retry: false as const,
  };
}

/** Public EIP-712 schema, exported for custom provider integrations and audits. */
export const TIMELOCK_APPROVAL_REQUEST_TYPES = SIGNED_OPERATION_TYPES;
