import type { Address, Hex } from "viem";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../shared/types/properties";
import type { SelectorTimelock, SignedTimelockApproval, TimelockSchedule } from "./types";

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
    account: Address;
    innerCallData: Hex;
    approvals?: readonly SignedTimelockApproval[];
  }
>;

/** Inputs for reading the timelock policy attached to one operation selector. */
export interface GetSelectorTimelockParameters {
  chainId?: number;
  account: Address;
  selector: Hex;
  /** Optional block snapshot for a consistent group of reads. */
  blockNumber?: bigint;
}

/** Inputs for reading the schedule keyed by exact operation calldata. */
export interface GetTimelockScheduleParameters {
  chainId?: number;
  account: Address;
  callData: Hex;
  /** Optional block snapshot for a consistent group of reads. */
  blockNumber?: bigint;
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
  /** For policy changes, false means no existing protection requires a schedule. */
  requiresSchedule?: boolean;
}
