import type { Address, Hash } from "viem";
import type { Config } from "../../core/config";
import type { GaslessWriteOptions } from "../../shared/types/properties";
import { resolveGaslessWrite } from "./resolve-gasless-write";
import { submitGaslessWrite } from "./submit-gasless-write";
import type { GaslessBillingAccount, GaslessDispatchCall } from "./types";

export type { GaslessDispatchCall } from "./types";

/** Input the write seams hand to {@link maybeRelayAsGasless}. @internal */
export interface MaybeRelayAsGaslessParameters {
  chainId?: number;
  from?: Address;
  /** The write's `gasless` parameter, verbatim. */
  gasless: boolean | GaslessWriteOptions | undefined;
  /** The calls, in execution order (a multi-call `_call` batch stays atomic as a relay batch). */
  calls: readonly GaslessDispatchCall[];
  /**
   * The sub-account the operations run under. The `_call` seam knows it; the
   * margin seam passes `virtualAccount` instead and the parent is resolved
   * on-chain (or taken from `gasless.account`).
   */
  signerAccount?: Address;
  /** The virtual account of a margin write, for parent-sub-account resolution. */
  virtualAccount?: Address;
  /**
   * An account a write targets that may be either a sub-account or a virtual
   * account — the deposit seams cannot tell the two apart from their parameters.
   * A VA resolves to its parent sub-account (a VA has no balance of its own to
   * bill); anything else is used as the billing account unchanged. Unlike
   * {@link MaybeRelayAsGaslessParameters.virtualAccount} this never throws for a
   * non-VA address.
   */
  accountMaybeVirtual?: Address;
}

/** Bridge for existing write seams: a relay broadcast hash, or null to continue their wallet path. @internal */
export async function maybeRelayAsGasless(
  config: Config,
  parameters: MaybeRelayAsGaslessParameters,
): Promise<Hash | null> {
  const billingAccount: GaslessBillingAccount = parameters.signerAccount
    ? { kind: "subaccount", account: parameters.signerAccount }
    : parameters.accountMaybeVirtual
      ? { kind: "account-or-virtual-account", account: parameters.accountMaybeVirtual }
      : parameters.virtualAccount
        ? { kind: "virtual-account", account: parameters.virtualAccount }
        : { kind: "explicit" };
  const resolved = await resolveGaslessWrite(config, { ...parameters, billingAccount });
  if (!resolved) return null;
  const result = await submitGaslessWrite(config, resolved, parameters.from);
  if (result.kind === "broadcast") return result.hash;
  if (resolved.fallback === "wallet") return null;
  throw result.error;
}
