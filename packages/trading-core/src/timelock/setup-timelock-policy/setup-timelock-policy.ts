import type { Hash, TransactionReceipt } from "viem";
import type { Config } from "../../core/config";
import { setupTimelocks, type TimelockWriteParameters } from "../../symmio-contracts/account-layer/actions/timelock";
import { confirmTimelockWrite } from "../confirm-write";
import {
  getTimelockPolicy,
  type GetTimelockPolicyParameters,
  type TimelockPolicyReport,
} from "../get-timelock-policy/get-timelock-policy";
import { assertTimelockPolicyChangeReady, getTimelockPolicyChange } from "../policy-change";

/** Indexing is separate from confirmation. Unknown is mandatory when the provider exposes no reliable observation. */
export type TimelockIndexingStatus = "indexed" | "pending" | "unknown";

/** Deployment-neutral indexing observer. It must use read-only evidence, never issue an approval as a probe. */
export interface TimelockPolicyIndexer {
  getStatus(policy: TimelockPolicyReport, receipt: TransactionReceipt): Promise<TimelockIndexingStatus>;
}

/** Setup defaults to the full selector policy and preserves longer existing delays. */
export type SetupTimelockPolicyParameters = GetTimelockPolicyParameters &
  TimelockWriteParameters & {
    delay?: bigint;
    indexer?: TimelockPolicyIndexer;
  };

/** A confirmed setup plus independently observed provider indexing. */
export interface TimelockSetupResult {
  hash: Hash;
  receipt: TransactionReceipt;
  policy: TimelockPolicyReport;
  indexing: TimelockIndexingStatus;
  /** Optional observer failure; the transaction is still confirmed, so do not repeat it. */
  indexingError?: unknown;
}

/** Failure after broadcast; reconcile this hash before another setup attempt. */
export class TimelockSetupConfirmationError extends Error {
  readonly hash: Hash;
  constructor(hash: Hash, cause: unknown) {
    super("Setup was submitted but confirmation or the policy read failed. Reconcile the original transaction.", {
      cause,
    });
    this.hash = hash;
  }
}

/**
 * Configure a root policy for a root or virtual account and wait for its receipt.
 * @param config - Chain, wallet and optional relay configuration.
 * @param parameters - Account/provider, optional increased delay and read-only indexing observer.
 * @returns Confirmed policy with honest indexing status; no automatic approval request or retry.
 * @throws {TimelockPolicyChangeAuthorizationError} If existing locks are weakened without a mature schedule.
 * @remarks Approvals for policy changes use explicit executeTimelockOp composition; this action never requests them.
 * @example const result = await setupTimelockPolicy(config, { account, gasless: true });
 */
export async function setupTimelockPolicy(
  config: Config,
  parameters: SetupTimelockPolicyParameters,
): Promise<TimelockSetupResult> {
  const policy = await getTimelockPolicy(config, parameters);
  const change = getTimelockPolicyChange(policy, parameters);
  await assertTimelockPolicyChangeReady(config, { chainId: parameters.chainId, change });
  const hash = await setupTimelocks(config, {
    ...parameters,
    account: policy.rootAccount,
    unlocker: policy.capability.unlocker,
    delay: change.delay,
    providerMinimumDelay: policy.requiredDelay,
    selectors: policy.selectors.map((item) => item.selector),
  });
  let receipt: TransactionReceipt;
  let updated: TimelockPolicyReport;
  try {
    receipt = await confirmTimelockWrite(config, parameters.chainId, hash);
    updated = await getTimelockPolicy(config, { ...parameters, capability: policy.capability });
  } catch (error) {
    throw new TimelockSetupConfirmationError(hash, error);
  }
  let indexing: TimelockIndexingStatus = "unknown";
  let indexingError: unknown;
  if (parameters.indexer) {
    try {
      indexing = await parameters.indexer.getStatus(updated, receipt);
    } catch (error) {
      indexingError = error;
    }
  }
  return {
    hash: receipt.transactionHash,
    receipt,
    policy: updated,
    indexing,
    ...(indexingError === undefined ? {} : { indexingError }),
  };
}

/** Setup mutation options explicitly disable automatic transaction retries. */
export function setupTimelockPolicyMutationOptions(config: Config) {
  return {
    mutationKey: ["setupTimelockPolicy"] as const,
    retry: false as const,
    mutationFn: (parameters: SetupTimelockPolicyParameters) => setupTimelockPolicy(config, parameters),
  };
}
