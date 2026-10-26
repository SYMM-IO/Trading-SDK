import { encodeFunctionData, isAddressEqual, keccak256, sliceHex, type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { SelectorTimelock, SignedTimelockApproval, TimelockApproval, TimelockSchedule } from "../types";
import { getVirtualAccount } from "./get-virtual-account";

/** Common wallet, simulation, chain, and gasless controls for AccountLayer timelock writes. */
export type TimelockWriteParameters = Compute<WriteContractParameter & GaslessWriteParameter>;

/** Inputs for configuring one unlocker and delay across a root account's selectors. */
export type SetupTimelocksParameters = Compute<
  TimelockWriteParameters & {
    /** Root sub-account. Timelocks must not be configured on a child VA. */
    account: Address;
    unlocker: Address;
    delay: bigint;
    /** Optional provider/solver minimum advertised off-chain. */
    providerMinimumDelay?: bigint;
    selectors: readonly Hex[];
  }
>;

/** Inputs for removing timelock policy from selectors on a root account. */
export type ClearTimelocksParameters = Compute<
  TimelockWriteParameters & { account: Address; selectors: readonly Hex[] }
>;

/** Inputs for scheduling the hash of exact raw operation calldata. */
export type ScheduleTimelockOpParameters = Compute<TimelockWriteParameters & { account: Address; callData: Hex }>;

/** Inputs for cancelling the schedule created for exact raw operation calldata. */
export type CancelTimelockOpParameters = ScheduleTimelockOpParameters;

/** Inputs for executing an AccountLayer call with approvals or a mature on-chain schedule. */
export type ExecuteTimelockOpParameters = Compute<
  TimelockWriteParameters & {
    /** Billing/authority root account used by gasless execution. */
    account: Address;
    /** AccountLayer calldata: `_call(account, [rawCoreCall])` for Core calls, or a direct AccountLayer call. */
    innerCallData: Hex;
    /** Empty only when executing a mature on-chain schedule. */
    approvals?: readonly SignedTimelockApproval[];
  }
>;

/** Inputs for reading the timelock policy attached to one operation selector. */
export interface GetSelectorTimelockParameters {
  chainId?: number;
  account: Address;
  selector: Hex;
}

/** Inputs for reading the schedule keyed by exact operation calldata. */
export interface GetTimelockScheduleParameters {
  chainId?: number;
  account: Address;
  callData: Hex;
}

/** Inputs for deriving a schedule's ready and expiry timestamps. */
export interface GetTimelockScheduleStateParameters extends GetTimelockScheduleParameters {
  /** Raw selector-bound operation calldata. Defaults to `callData`. */
  operationCallData?: Hex;
}

/** Schedule, selector policy, and derived execution window for one operation. */
export interface TimelockScheduleState {
  callDataHash: Hex;
  schedule: TimelockSchedule;
  policy: SelectorTimelock;
  gracePeriod: bigint;
  readyAt: bigint | null;
  expiresAt: bigint | null;
}

/**
 * Resolve a virtual account to its parent root sub-account.
 *
 * @param config - SDK configuration used for the AccountLayer read.
 * @param parameters - Account address and optional chain override.
 * @returns The VA parent when `account` is a live VA; otherwise `account` unchanged.
 *
 * @example
 * ```ts
 * const root = await resolveTimelockRootAccount(config, { account: virtualAccount });
 * ```
 */
export async function resolveTimelockRootAccount(
  config: Config,
  parameters: { chainId?: number; account: Address },
): Promise<Address> {
  const detail = await getVirtualAccount(config, parameters);
  return detail.isExists ? detail.parentAccount : parameters.account;
}

/**
 * Read the unlocker and delay configured for one root-account selector.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Root account, selector or calldata, and optional chain.
 * @returns The configured unlocker and delay; zero values mean no policy.
 *
 * @example
 * ```ts
 * const policy = await getSelectorTimelock(config, { account: root, selector: "0xb48c2317" });
 * ```
 */
export async function getSelectorTimelock(
  config: Config,
  parameters: GetSelectorTimelockParameters,
): Promise<SelectorTimelock> {
  const { addresses } = config.getChainConfig(parameters.chainId);
  const raw = await config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getSelectorTimelock",
    args: [parameters.account, selectorOf(parameters.selector)],
  });
  return { unlocker: raw.unlocker, delay: raw.delay };
}

/**
 * Read the schedule for the hash of exact raw operation calldata.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Root account, raw calldata, and optional chain.
 * @returns The schedule timestamp and nonce; zero values mean no active schedule.
 */
export async function getTimelockSchedule(
  config: Config,
  parameters: GetTimelockScheduleParameters,
): Promise<TimelockSchedule> {
  const { addresses } = config.getChainConfig(parameters.chainId);
  const raw = await config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getSchedule",
    args: [parameters.account, keccak256(parameters.callData)],
  });
  return { scheduledAt: raw.scheduledAt, nonce: raw.nonce };
}

/**
 * Read AccountLayer's contract-wide minimum timelock delay.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Optional chain override.
 * @returns The minimum delay in seconds.
 */
export async function getMinTimelockDelay(config: Config, parameters: { chainId?: number } = {}): Promise<bigint> {
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "minTimelockDelay",
  });
}

/**
 * Read how long a mature schedule remains executable.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Optional chain override.
 * @returns The schedule grace period in seconds.
 */
export async function getTimelockScheduleGracePeriod(
  config: Config,
  parameters: { chainId?: number } = {},
): Promise<bigint> {
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "scheduleGracePeriod",
  });
}

/**
 * Return the contract's canonical EIP-712 digest for an approval tuple.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Approval tuple and optional chain.
 * @returns The approval digest used by events and replay protection.
 */
export async function hashTimelockApproval(
  config: Config,
  parameters: { chainId?: number; approval: TimelockApproval },
): Promise<Hex> {
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "hashTimelockApproval",
    args: [parameters.approval],
  });
}

/**
 * Read whether a single-use approval digest has already been consumed.
 *
 * @param config - SDK configuration used for the contract read.
 * @param parameters - Approval digest and optional chain.
 * @returns `true` after that approval has been executed.
 */
export async function isTimelockApprovalUsed(
  config: Config,
  parameters: { chainId?: number; approvalHash: Hex },
): Promise<boolean> {
  const { addresses } = config.getChainConfig(parameters.chainId);
  return config.getClient({ chainId: parameters.chainId }).readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "isApprovalUsed",
    args: [parameters.approvalHash],
  });
}

/**
 * Derive the execution window for one scheduled operation.
 *
 * @param config - SDK configuration used for policy and schedule reads.
 * @param parameters - Root account and exact raw operation calldata.
 * @returns The stored schedule, policy, grace period, and derived timestamps.
 */
export async function getTimelockScheduleState(
  config: Config,
  parameters: GetTimelockScheduleStateParameters,
): Promise<TimelockScheduleState> {
  const operationCallData = parameters.operationCallData ?? parameters.callData;
  const [schedule, policy, gracePeriod] = await Promise.all([
    getTimelockSchedule(config, parameters),
    getSelectorTimelock(config, {
      chainId: parameters.chainId,
      account: parameters.account,
      selector: operationCallData,
    }),
    getTimelockScheduleGracePeriod(config, { chainId: parameters.chainId }),
  ]);
  const readyAt = schedule.scheduledAt === 0n ? null : schedule.scheduledAt + policy.delay;
  return {
    callDataHash: keccak256(parameters.callData),
    schedule,
    policy,
    gracePeriod,
    readyAt,
    expiresAt: readyAt === null ? null : readyAt + gracePeriod,
  };
}

/**
 * Configure timelock policy for selectors on a root sub-account.
 *
 * @param config - SDK configuration used for reads and submission.
 * @param parameters - Root account, unlocker, delay, selectors, and write controls.
 * @returns The wallet or relayer transaction hash.
 * @throws {RangeError} When the delay is below the contract or provider minimum.
 * @throws {SymmError} When `account` is a virtual account instead of its root.
 *
 * @example
 * ```ts
 * await setupTimelocks(config, { account: root, unlocker, delay: 600n, selectors, gasless: true });
 * ```
 */
export async function setupTimelocks(config: Config, parameters: SetupTimelocksParameters): Promise<Hash> {
  const minDelay = await getMinTimelockDelay(config, { chainId: parameters.chainId });
  const requiredDelay =
    parameters.providerMinimumDelay !== undefined && parameters.providerMinimumDelay > minDelay
      ? parameters.providerMinimumDelay
      : minDelay;
  if (parameters.delay < requiredDelay) {
    throw new RangeError(`setupTimelocks: delay ${parameters.delay} is below the required minimum ${requiredDelay}.`);
  }
  return writeTimelock(config, parameters, "setupTimelocks", [
    parameters.account,
    parameters.unlocker,
    parameters.delay,
    parameters.selectors.map(selectorOf),
  ]);
}

/**
 * Remove timelock policy from selectors on a root sub-account.
 *
 * @param config - SDK configuration used for submission.
 * @param parameters - Root account, selectors, and write controls.
 * @returns The wallet or relayer transaction hash.
 */
export async function clearTimelocks(config: Config, parameters: ClearTimelocksParameters): Promise<Hash> {
  return writeTimelock(config, parameters, "clearTimelocks", [
    parameters.account,
    parameters.selectors.map(selectorOf),
  ]);
}

/**
 * Schedule exact raw operation calldata for delayed execution without an approval.
 *
 * @param config - SDK configuration used for submission.
 * @param parameters - Root account, raw Core or AccountLayer calldata, and write controls.
 * @returns The wallet or relayer transaction hash.
 *
 * @example
 * ```ts
 * await scheduleTimelockOp(config, { account: root, callData: rawWithdrawCall, gasless: true });
 * ```
 */
export async function scheduleTimelockOp(config: Config, parameters: ScheduleTimelockOpParameters): Promise<Hash> {
  return writeTimelock(config, parameters, "scheduleTimelockOp", [parameters.account, keccak256(parameters.callData)]);
}

/**
 * Cancel a pending fallback schedule before its operation executes.
 *
 * @param config - SDK configuration used for submission.
 * @param parameters - Root account, the same raw calldata that was scheduled, and write controls.
 * @returns The wallet or relayer transaction hash.
 */
export async function cancelTimelockOp(config: Config, parameters: CancelTimelockOpParameters): Promise<Hash> {
  return writeTimelock(config, parameters, "cancelTimelockOp", [parameters.account, keccak256(parameters.callData)]);
}

/**
 * Execute an AccountLayer inner call using signed approvals or a mature schedule.
 *
 * Core operations must be wrapped with {@link encodeTimelockedCoreCall}; direct
 * AccountLayer operations use their own calldata. Pass no approvals only for a
 * scheduled operation whose delay has matured.
 *
 * @param config - SDK configuration used for submission.
 * @param parameters - Root account, inner AccountLayer calldata, approvals, and write controls.
 * @returns The wallet or relayer transaction hash.
 *
 * @example
 * ```ts
 * await executeTimelockOp(config, { account: root, innerCallData, approvals: [signedApproval], gasless: true });
 * ```
 */
export async function executeTimelockOp(config: Config, parameters: ExecuteTimelockOpParameters): Promise<Hash> {
  return writeTimelock(config, parameters, "executeTimelockOp", [
    [...(parameters.approvals ?? [])],
    parameters.innerCallData,
  ]);
}

function selectorOf(value: Hex): Hex {
  return value.length === 10 ? value : sliceHex(value, 0, 4);
}

async function writeTimelock(
  config: Config,
  parameters: TimelockWriteParameters & { account: Address },
  functionName: "setupTimelocks" | "clearTimelocks" | "scheduleTimelockOp" | "cancelTimelockOp" | "executeTimelockOp",
  args: readonly unknown[],
): Promise<Hash> {
  const rootAccount = await resolveTimelockRootAccount(config, parameters);
  if (!isAddressEqual(rootAccount, parameters.account)) {
    throw new SymmError(
      "validation",
      "TIMELOCK_ROOT_ACCOUNT_REQUIRED",
      `Timelock policy, schedules, and approvals belong to root sub-account ${rootAccount}, not virtual account ${parameters.account}.`,
    );
  }
  const { addresses, chainId } = config.getChainConfig(parameters.chainId);
  const callData = encodeFunctionData({ abi: accountLayerAbi, functionName, args } as never);
  const relayed = await maybeRelayAsGasless(config, {
    chainId: parameters.chainId,
    from: parameters.from,
    gasless: parameters.gasless,
    signerAccount: parameters.account,
    calls: [{ target: addresses.accountLayerAddress, callData }],
  });
  if (relayed !== null) return relayed;

  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });
  if (walletClient.chain?.id !== chainId)
    throw new SymmError(
      "validation",
      "TIMELOCK_WALLET_CHAIN_MISMATCH",
      "Switch the execution wallet to the selected chain.",
    );
  if (shouldSimulateBeforeWrite(config, parameters)) {
    await config.getClient({ chainId: parameters.chainId }).simulateContract({
      address: addresses.accountLayerAddress,
      abi: accountLayerAbi,
      functionName,
      args,
      account: walletClient.account.address,
    } as never);
  }
  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName,
    args,
    account: walletClient.account,
    chain: walletClient.chain,
  } as never);
}
