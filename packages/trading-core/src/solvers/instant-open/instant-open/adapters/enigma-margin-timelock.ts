import { isAxiosError } from "axios";
import { encodeFunctionData, hexToBigInt, keccak256, sliceHex, type Address, type Hex } from "viem";
import { SymmApiError, SymmError } from "../../../../shared/errors/symm-error";
import { accountLayerAbi } from "../../../../symmio-contracts/abi/v0.8.6/account-layer";
import { resolveTimelockRootAccount } from "../../../../symmio-contracts/account-layer/actions/timelock";
import { INSTANT_OPEN_TIMELOCK_SELECTORS } from "../../../../timelock/policy";
import { parseTimelockInfo } from "../../../get-solver-info/parse-timelock-info";
import { getInfo } from "../../../types/generated/enigma-solver";
import { generateSalt } from "../../shared/operations";
import type { FlexField } from "../../shared/types";
import type { InstantOpenAdapterContext } from "./context";

function invalidMetadata(): never {
  throw new SymmError(
    "api",
    "INVALID_INSTANT_OPEN_TIMELOCK_METADATA",
    "instantOpen: the solver's timelock metadata is invalid or belongs to a different chain or AccountLayer.",
  );
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
  requestedDeadline: bigint,
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
  let metadata;
  try {
    metadata = parseTimelockInfo(data, context.chainConfig);
  } catch {
    return invalidMetadata();
  }
  if (!metadata) return legacy;

  const root = await resolveTimelockRootAccount(context.config, { chainId: context.chainId, account });
  if (root.toLowerCase() !== account.toLowerCase())
    throw new SymmError(
      "validation",
      "INSTANT_OPEN_ROOT_ACCOUNT_REQUIRED",
      "Wrapped instant opens require the resolved root subaccount in both operations.",
    );
  if (context.walletClient.chain?.id !== context.chainConfig.chainId)
    throw new SymmError(
      "validation",
      "TIMELOCK_WALLET_CHAIN_MISMATCH",
      "Switch the signing wallet to the selected chain.",
    );

  const client = context.config.getClient({ chainId: context.chainConfig.chainId });
  const ready = await client.readContract({
    address: context.chainConfig.addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "allTimelockedBy",
    args: [root, metadata.unlocker, BigInt(metadata.minTimelockDelaySeconds), INSTANT_OPEN_TIMELOCK_SELECTORS],
  });
  if (!ready) {
    throw new SymmError(
      "validation",
      "INSTANT_OPEN_TIMELOCK_POLICY_REQUIRED",
      "instantOpen: the account does not have the solver's required timelock policy. Configure the account's timelocks with the owner's approval before opening a position.",
    );
  }
  const { timestamp } = await client.getBlock({ blockTag: "latest" });
  const approvalDeadline = requestedDeadline;
  if (approvalDeadline <= 0n || approvalDeadline > 9223372036854775807n || approvalDeadline - timestamp < 30n) {
    throw new SymmError(
      "validation",
      "INSTANT_OPEN_TIMELOCK_APPROVAL_EXPIRED",
      "Margin approval requires a positive int64 Unix deadline with at least 30 seconds remaining.",
    );
  }
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
