import type { Address, Hash } from "viem";
import type { Config } from "../core/config";
import { getGaslessAttemptStart } from "../gasless/dispatch/attempt-start";
import { resolveGaslessWrite } from "../gasless/dispatch/resolve-gasless-write";
import { submitGaslessWrite } from "../gasless/dispatch/submit-gasless-write";
import type { GaslessBillingAccount, GaslessDispatchCall } from "../gasless/dispatch/types";
import type { GaslessWriteParameter, WriteContractParameter } from "../shared/types/properties";

/**
 * Action-specific relay capabilities. An omitted `relay` keeps the action on
 * the wallet, and refuses a write that demands gasless (a caller-owned key, or
 * `enabled: true` without a wallet fallback) with `GASLESS_NOT_RELAYABLE`.
 * @internal
 */
export interface WriteExecutionCapabilities {
  relay?: { billingAccount: GaslessBillingAccount };
}

/** Separate relay calls from the wallet implementation, which may use a contract proxy. @internal */
export interface WriteExecution extends WriteExecutionCapabilities {
  calls: readonly GaslessDispatchCall[];
  submitWallet(from?: Address): Promise<Hash>;
}

/**
 * Coordinate execution once; transport callbacks never re-enter routing.
 *
 * A relayed write returns the relayer's first broadcast hash. A definitive
 * pre-acceptance refusal falls back to the wallet only when the resolved
 * policy says `"wallet"` — never for a write with a caller-owned
 * `gasless.idempotencyKey`, whose policy is always `"error"`.
 *
 * @internal
 */
export async function executeWrite(
  config: Config,
  parameters: WriteContractParameter & GaslessWriteParameter,
  write: WriteExecution,
): Promise<Hash> {
  /** Before any read: the billing-account lookup below counts against the signature lifetime. */
  const startedAtMs = getGaslessAttemptStart(parameters.gasless) ?? Date.now();
  /**
   * Resolved even without a relay capability: a keyed or explicitly gasless
   * write must be refused before any wallet is resolved, never sent through it.
   */
  const relay = await resolveGaslessWrite(config, {
    ...parameters,
    calls: write.calls,
    billingAccount: write.relay?.billingAccount ?? null,
  });
  if (!relay) return write.submitWallet(parameters.from);

  const result = await submitGaslessWrite(config, relay, { from: parameters.from, startedAtMs });
  if (result.kind === "broadcast") return result.hash;
  if (relay.fallback === "wallet") return write.submitWallet(parameters.from);
  throw result.error;
}
