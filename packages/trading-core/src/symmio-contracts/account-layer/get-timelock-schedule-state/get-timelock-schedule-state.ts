import {
  decodeFunctionData,
  getAbiItem,
  isAddressEqual,
  keccak256,
  sliceHex,
  toFunctionSelector,
  zeroAddress,
  type Abi,
  type AbiFunction,
} from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { assertTimelockSupported } from "../../../timelock/support";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { getSelectorTimelock } from "../get-selector-timelock";
import { getTimelockSchedule } from "../get-timelock-schedule";
import { getTimelockScheduleGracePeriod } from "../get-timelock-schedule-grace-period";
import type { GetTimelockScheduleStateParameters, TimelockScheduleState } from "../timelock-types";
import type { SelectorTimelock } from "../types";

/**
 * Derive the execution window for one scheduled operation.
 *
 * @param config - SDK configuration used for policy and schedule reads.
 * @param parameters - Root account and exact raw operation calldata.
 * @returns The stored schedule, policy, grace period, and derived timestamps.
 * @remarks For policy changes this is the window when executing without approvals. Partial approvals can change it.
 */
export async function getTimelockScheduleState(
  config: Config,
  parameters: GetTimelockScheduleStateParameters,
): Promise<TimelockScheduleState> {
  assertTimelockSupported(config, parameters.chainId);
  const operationCallData = parameters.operationCallData ?? parameters.callData;
  const blockNumber =
    parameters.blockNumber ?? (await config.getClient({ chainId: parameters.chainId }).getBlockNumber());
  const policySelectors = ["setupTimelocks", "clearTimelocks"].map((name) =>
    toFunctionSelector(getAbiItem({ abi: accountLayerAbi as Abi, name }) as AbiFunction),
  );
  const isPolicyChange = operationCallData.length >= 10 && policySelectors.includes(sliceHex(operationCallData, 0, 4));
  const scheduledPolicyChange =
    parameters.callData.length >= 10 && policySelectors.includes(sliceHex(parameters.callData, 0, 4));
  if (
    (isPolicyChange || scheduledPolicyChange) &&
    operationCallData.toLowerCase() !== parameters.callData.toLowerCase()
  )
    throw new SymmError(
      "validation",
      "TIMELOCK_POLICY_CALL_MISMATCH",
      "A policy schedule must use the exact policy calldata.",
    );
  let policyRead: Promise<SelectorTimelock>;
  let requiresSchedule: boolean | undefined;
  if (isPolicyChange) {
    const decoded = decodeFunctionData({ abi: accountLayerAbi, data: operationCallData });
    if (decoded.functionName !== "setupTimelocks" && decoded.functionName !== "clearTimelocks")
      throw new SymmError("validation", "TIMELOCK_POLICY_CALL_INVALID", "Invalid timelock policy calldata.");
    if (!isAddressEqual(decoded.args[0], parameters.account))
      throw new SymmError(
        "validation",
        "TIMELOCK_POLICY_ACCOUNT_MISMATCH",
        "The scheduled policy change targets a different root account.",
      );
    const selectors = decoded.functionName === "setupTimelocks" ? decoded.args[3] : decoded.args[1];
    policyRead = Promise.all(
      selectors.map((selector) =>
        getSelectorTimelock(config, {
          chainId: parameters.chainId,
          account: parameters.account,
          selector,
          blockNumber,
        }),
      ),
    ).then((policies) => {
      const affected = policies.filter((policy) => {
        if (isAddressEqual(policy.unlocker, zeroAddress)) return false;
        return (
          decoded.functionName !== "setupTimelocks" ||
          !isAddressEqual(policy.unlocker, decoded.args[1]) ||
          policy.delay > decoded.args[2]
        );
      });
      requiresSchedule = affected.length > 0;
      return affected.reduce<SelectorTimelock>((max, policy) => (policy.delay > max.delay ? policy : max), {
        unlocker: zeroAddress,
        delay: 0n,
      });
    });
  } else {
    policyRead = getSelectorTimelock(config, {
      chainId: parameters.chainId,
      account: parameters.account,
      selector: operationCallData,
      blockNumber,
    });
  }
  const [schedule, policy, gracePeriod] = await Promise.all([
    getTimelockSchedule(config, { ...parameters, blockNumber }),
    policyRead,
    getTimelockScheduleGracePeriod(config, { chainId: parameters.chainId, blockNumber }),
  ]);
  const readyAt =
    schedule.scheduledAt === 0n || requiresSchedule === false ? null : schedule.scheduledAt + policy.delay;
  return {
    callDataHash: keccak256(parameters.callData),
    schedule,
    policy,
    gracePeriod,
    readyAt,
    expiresAt: readyAt === null ? null : readyAt + gracePeriod,
    ...(requiresSchedule === undefined ? {} : { requiresSchedule }),
  };
}
