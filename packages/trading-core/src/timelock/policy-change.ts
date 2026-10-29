import { encodeFunctionData, isAddressEqual, zeroAddress, type Address, type Hex } from "viem";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import {
  getTimelockSchedule,
  getTimelockScheduleGracePeriod,
} from "../symmio-contracts/account-layer/actions/timelock";
import type { TimelockPolicyReport } from "./get-timelock-policy/get-timelock-policy";

/** Exact setup calldata and the existing locks that must authorize this change. */
export interface TimelockPolicyChange {
  /** Root account whose policy changes. */
  account: Address;
  /** Proposed unlocker and delay in seconds. */
  unlocker: Address;
  delay: bigint;
  /** Every selector included in the proposed setup, including unchanged selectors. */
  selectors: readonly Hex[];
  /** Raw setupTimelocks calldata; schedule its hash or execute it with valid approvals. */
  callData: Hex;
  /** True for any shorter existing delay or changed existing unlocker. Not a schedule-readiness flag. */
  requiresAuthorization: boolean;
  /** Existing locks weakened by the proposed setup. */
  affectedSelectors: readonly { selector: Hex; unlocker: Address; delay: bigint }[];
  /** Distinct current unlockers, each authorizing the exact setup calldata. */
  requiredUnlockers: readonly Address[];
  /** Longest affected existing delay, in seconds, when executing without any approvals. */
  scheduleDelaySeconds: bigint;
}

/**
 * Assess a setup from an observed policy without signing, submitting, or selecting a recovery route.
 * @param policy - Report from getTimelockPolicy; its capability supplies the proposed unlocker.
 * @param parameters - Optional proposed delay; defaults to the greater of the minimum and existing selector delays.
 * @returns Exact calldata and authorization requirements, not proof of current chain readiness.
 * @throws {RangeError} If the proposed delay is below the report's required minimum.
 * @example const change = getTimelockPolicyChange(policy, { delay: 600n });
 */
export function getTimelockPolicyChange(
  policy: TimelockPolicyReport,
  parameters: { delay?: bigint } = {},
): TimelockPolicyChange {
  const delay =
    parameters.delay ??
    policy.selectors.reduce((highest, item) => (item.delay > highest ? item.delay : highest), policy.requiredDelay);
  if (delay < policy.requiredDelay)
    throw new RangeError(`setupTimelocks: delay ${delay} is below the required minimum ${policy.requiredDelay}.`);
  const unlocker = policy.capability.unlocker;
  const selectors = policy.selectors.map((item) => item.selector);
  const affectedSelectors = policy.selectors
    .filter(
      (item) =>
        !isAddressEqual(item.unlocker, zeroAddress) && (!isAddressEqual(item.unlocker, unlocker) || delay < item.delay),
    )
    .map(({ selector, unlocker: currentUnlocker, delay: currentDelay }) => ({
      selector,
      unlocker: currentUnlocker,
      delay: currentDelay,
    }));
  const requiredUnlockers: Address[] = [];
  let scheduleDelaySeconds = 0n;
  for (const item of affectedSelectors) {
    if (!requiredUnlockers.some((address) => isAddressEqual(address, item.unlocker)))
      requiredUnlockers.push(item.unlocker);
    if (item.delay > scheduleDelaySeconds) scheduleDelaySeconds = item.delay;
  }
  return {
    account: policy.rootAccount,
    unlocker,
    delay,
    selectors,
    callData: encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "setupTimelocks",
      args: [policy.rootAccount, unlocker, delay, selectors],
    }),
    requiresAuthorization: affectedSelectors.length > 0,
    affectedSelectors,
    requiredUnlockers,
    scheduleDelaySeconds,
  };
}

/**
 * Setup needs existing-unlocker approval or a usable schedule; no write was attempted.
 * React normalization retains this error in `cause` and preserves its `code`.
 * @example if (error instanceof TimelockPolicyChangeAuthorizationError) showChange(error.change);
 */
export class TimelockPolicyChangeAuthorizationError extends SymmError {
  override readonly name = "TimelockPolicyChangeAuthorizationError";

  constructor(
    /** Exact proposed change and required current unlockers. */
    readonly change: TimelockPolicyChange,
    /** Observed schedule execution window in Unix seconds; null when no valid schedule exists. */
    readonly readyAt: bigint | null,
    readonly expiresAt: bigint | null,
  ) {
    super(
      "validation",
      "TIMELOCK_POLICY_CHANGE_AUTHORIZATION_REQUIRED",
      "This policy change requires approval from the current unlockers or a mature schedule. No setup transaction was submitted.",
    );
  }
}

/**
 * Check whether an observed setup change can proceed without unlocker approvals.
 * Use before composing a setup batch or selecting a wallet route; this performs reads only.
 * @param config - Deployment/client configuration.
 * @param parameters - Change from getTimelockPolicyChange and the same optional chain override used for its policy read.
 * @returns Resolves for an unprotected change or a mature schedule for its exact calldata.
 * @throws {TimelockPolicyChangeAuthorizationError} When the change requires authorization and has no usable schedule.
 * @remarks Reassess policy before calling. A read is not a reservation; simulation/execution remains authoritative.
 * @example await assertTimelockPolicyChangeReady(config, { change, chainId });
 */
export async function assertTimelockPolicyChangeReady(
  config: Config,
  parameters: { chainId?: number; change: TimelockPolicyChange },
): Promise<void> {
  const { change, chainId } = parameters;
  if (!change.requiresAuthorization) return;
  const [schedule, gracePeriod, block] = await Promise.all([
    getTimelockSchedule(config, { chainId, account: change.account, callData: change.callData }),
    getTimelockScheduleGracePeriod(config, { chainId }),
    config.getClient({ chainId }).getBlock({ blockTag: "latest" }),
  ]);
  const readyAt = schedule.scheduledAt === 0n ? null : schedule.scheduledAt + change.scheduleDelaySeconds;
  const expiresAt = readyAt === null ? null : readyAt + gracePeriod;
  if (readyAt === null || expiresAt === null || block.timestamp < readyAt || block.timestamp > expiresAt)
    throw new TimelockPolicyChangeAuthorizationError(change, readyAt, expiresAt);
}
