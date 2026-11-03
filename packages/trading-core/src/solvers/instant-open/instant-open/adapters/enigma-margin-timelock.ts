import { isAxiosError } from "axios";
import {
  encodeFunctionData,
  getAbiItem,
  hexToBigInt,
  isAddress,
  keccak256,
  sliceHex,
  toFunctionSelector,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { SymmApiError, SymmError } from "../../../../shared/errors/symm-error";
import { accountLayerAbi } from "../../../../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../../../../symmio-contracts/abi/v0.8.6/symmio";
import { getInfo } from "../../../types/generated/enigma-solver";
import { generateSalt } from "../../shared/operations";
import type { FlexField } from "../../shared/types";
import type { InstantOpenAdapterContext } from "./context";

/** The approvable selector policy published by Enigma's /timelock-approval schema. */
const REQUIRED_CORE_SELECTORS = [
  "withdraw",
  "withdrawTo",
  "initiateWithdraw",
  "internalTransfer",
  "allocate",
  "externalTransfer",
  "virtualExternalTransfer",
  "transferToBridge",
  "deallocate",
  "safeDeallocate",
  "depositToReserveVault",
  "approveOperationalFee",
  "approveOperationalFeeWithMultiplier",
] as const;
const REQUIRED_ACCOUNT_SELECTORS = [
  "addMargin",
  "addMarginToNextVA",
  "removeMargin",
  "safeRemoveMargin",
  "emergencyRecoverMargin",
  "transferSubAccountOwnership",
  "deleteSubAccount",
  "setSingleVAMode",
  "createCustomVirtualAccount",
] as const;
const REQUIRED_TIMELOCK_SELECTORS = [
  ...REQUIRED_CORE_SELECTORS.map((name) => toFunctionSelector(getAbiItem({ abi: symmioAbi, name }))),
  ...REQUIRED_ACCOUNT_SELECTORS.map((name) => toFunctionSelector(getAbiItem({ abi: accountLayerAbi, name }))),
];

interface TimelockMetadata {
  unlocker: Address;
  validitySeconds: number;
  minimumDelay: bigint;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function invalidMetadata(): never {
  throw new SymmError(
    "api",
    "INVALID_INSTANT_OPEN_TIMELOCK_METADATA",
    "instantOpen: the solver's timelock metadata is invalid or belongs to a different chain or AccountLayer.",
  );
}

function parseMetadata(data: unknown, context: InstantOpenAdapterContext): TimelockMetadata | undefined {
  const info = record(data);
  if (!info) return invalidMetadata();
  // Older Enigma deployments do not advertise this capability. A failed fetch
  // or an explicitly malformed capability must never select the legacy path.
  if (!("timelock_approval" in info)) return undefined;
  const metadata = record(info.timelock_approval);
  const domain = record(metadata?.request_domain);
  const unlocker = metadata?.unlocker;
  const validity = metadata?.validity_seconds;
  const delay = metadata?.min_timelock_delay_seconds;
  if (
    typeof unlocker !== "string" ||
    !isAddress(unlocker, { strict: false }) ||
    unlocker.toLowerCase() === zeroAddress ||
    typeof validity !== "number" ||
    !Number.isSafeInteger(validity) ||
    validity < 30 ||
    typeof delay !== "number" ||
    !Number.isSafeInteger(delay) ||
    delay < 0 ||
    domain?.name !== "SymmioTimelockApprovalRequest" ||
    domain.version !== "1" ||
    domain.chainId !== String(context.chainConfig.chainId) ||
    typeof domain.verifyingContract !== "string" ||
    domain.verifyingContract.toLowerCase() !== context.chainConfig.addresses.accountLayerAddress.toLowerCase()
  )
    return invalidMetadata();
  return { unlocker: unlocker.toLowerCase() as Address, validitySeconds: validity, minimumDelay: BigInt(delay) };
}

/** Locate only the reserved signature bytes; every ABI word remains signed and fixed. */
function signatureFlexField(callData: Hex, solver: Address): FlexField {
  const args = sliceHex(callData, 4);
  const word = (offset: number) => Number(hexToBigInt(sliceHex(args, offset, offset + 32)));
  const array = word(0);
  const tuple = array + 32 + word(array + 32);
  const lengthWord = tuple + word(tuple + 5 * 32);
  return { offset: BigInt(lengthWord + 32), length: 65n, authorizedFlexFiller: solver };
}

/**
 * Resolve the solver-advertised margin wrapper and verify its account policy.
 * No timelock configuration or approval issuance is performed by this read path.
 * @internal
 */
export async function prepareEnigmaMarginTimelock(
  context: InstantOpenAdapterContext,
  account: Address,
  innerCallData: Hex,
): Promise<{ callData: Hex; flexFields: FlexField[]; approvalDeadline?: bigint }> {
  const legacy = { callData: innerCallData, flexFields: [] };
  if (context.chainConfig.contractsVersion === "0.8.5") return legacy;

  let data: unknown;
  try {
    data = (await getInfo({ baseURL: context.solver.url })).data;
  } catch (error) {
    if (isAxiosError(error)) {
      throw SymmApiError.fromAxios(error, {
        code: "FETCH_INSTANT_OPEN_TIMELOCK_METADATA_FAILED",
        baseURL: context.solver.url,
      });
    }
    throw new SymmError(
      "api",
      "FETCH_INSTANT_OPEN_TIMELOCK_METADATA_FAILED",
      "instantOpen: unable to read the solver's timelock requirements.",
      {
        cause: error instanceof Error ? error : undefined,
      },
    );
  }
  const metadata = parseMetadata(data, context);
  if (!metadata) return legacy;

  const client = context.config.getClient({ chainId: context.chainConfig.chainId });
  const ready = await client.readContract({
    address: context.chainConfig.addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "allTimelockedBy",
    args: [account, metadata.unlocker, metadata.minimumDelay, REQUIRED_TIMELOCK_SELECTORS],
  });
  if (!ready) {
    throw new SymmError(
      "validation",
      "INSTANT_OPEN_TIMELOCK_POLICY_REQUIRED",
      "instantOpen: the account does not have the solver's required timelock policy. Configure the account's timelocks with the owner's approval before opening a position.",
    );
  }
  const { timestamp } = await client.getBlock({ blockTag: "latest" });
  const approvalDeadline = timestamp + BigInt(metadata.validitySeconds);
  const callData = encodeFunctionData({
    abi: accountLayerAbi,
    functionName: "executeTimelockOp",
    args: [
      [
        {
          approval: {
            account,
            unlocker: metadata.unlocker,
            callDataHash: keccak256(innerCallData),
            deadline: approvalDeadline,
            salt: generateSalt(),
          },
          signature: `0x${"00".repeat(65)}`,
        },
      ],
      innerCallData,
    ],
  });
  return { callData, flexFields: [signatureFlexField(callData, context.solver.address)], approvalDeadline };
}

/** Reject a wallet-delayed approval before POST; its immutable deadline cannot be refreshed. @internal */
export async function assertEnigmaMarginTimelockFresh(
  context: InstantOpenAdapterContext,
  approvalDeadline: bigint | undefined,
): Promise<void> {
  if (approvalDeadline === undefined) return;
  const { timestamp } = await context.config
    .getClient({ chainId: context.chainConfig.chainId })
    .getBlock({ blockTag: "latest" });
  if (approvalDeadline - timestamp < 30n) {
    throw new SymmError(
      "validation",
      "INSTANT_OPEN_TIMELOCK_APPROVAL_EXPIRED",
      "instantOpen: the timelock approval has less than 30 seconds remaining. Prepare and sign a fresh order before submitting.",
    );
  }
}
