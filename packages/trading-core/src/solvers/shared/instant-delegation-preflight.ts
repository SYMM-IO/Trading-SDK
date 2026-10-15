import type { Address, Hex } from "viem";
import type { Config } from "../../core/config";
import { findUndelegatedGaslessSelectors, getCachedDelegatorAccount } from "../../gasless/delegation-preflight";
import { SymmError } from "../../shared/errors/symm-error";
import type { SignedOperation } from "../instant-open/shared/types";

/**
 * Per-call switch for the delegation check that instant trade writes run
 * before signing.
 *
 * `instantOpen`, `instantClose` and `instantCloseBulk` — and every flow built
 * on them (`instantOpenAuto`, `limitOpenAuto`, `instantCloseAuto`,
 * `limitCloseAuto`, `instantCloseBulkAuto`) — confirm that the signer may act
 * for the account each operation runs under before anything is signed or sent
 * to the solver. A session key without the InstantLayer delegation fails right
 * there with `INSTANT_SIGNER_NOT_DELEGATED`, instead of after the solver tries
 * to execute the trade. The account's owner needs no delegation, so an
 * owner-signed trade skips the delegation reads.
 *
 * @example
 * ```ts
 * // The app already gates its trade button on delegation: skip the extra read.
 * await instantClose(config, { from: sessionKey, partyA, order, preflightDelegation: false });
 * ```
 */
export interface InstantDelegationPreflightParameter {
  /**
   * Check, before signing, that the signer holds an active InstantLayer
   * delegation for every operation it signs, and throw
   * `INSTANT_SIGNER_NOT_DELEGATED` when it does not. Defaults to `true`.
   *
   * Pass `false` when your app already gates the trade on delegation and you
   * want to skip the extra RPC read.
   */
  preflightDelegation?: boolean;
}

/** The selectors one signer signs under one delegator account. */
interface DelegationCheck {
  signer: Address;
  account: Address;
  selectors: Set<Hex>;
}

/**
 * Throw when the signer of a set of instant-trade operations lacks the
 * InstantLayer delegation they need — before any of them is signed or sent.
 *
 * Built on the gasless relay's delegation pre-flight
 * (`findUndelegatedGaslessSelectors`), so relayed writes and instant trades
 * share one delegation check. This adds the two steps that check leaves to its
 * caller:
 *
 * 1. Each operation's selector is read from its calldata, so the check covers
 *    exactly what is about to be signed.
 * 2. Each operation's `signerAccount` is resolved to its delegator — a live
 *    virtual account to its parent sub-account, as the InstantLayer does.
 *    Without it a close signed under a virtual account would skip the check.
 *
 * Operations are grouped by signer and delegator, so a bulk close across many
 * virtual accounts of one sub-account costs one check.
 *
 * @param config - The SDK config.
 * @param parameters - The chain, the calling action (named in the error), the
 *   operations about to be signed, and `enabled` (`false` skips the check).
 * @throws {SymmError} `INSTANT_SIGNER_NOT_DELEGATED` naming every signer,
 *   sub-account and selector that lacks an active delegation.
 *
 * @internal
 */
export async function assertInstantSignerDelegated(
  config: Config,
  parameters: {
    chainId?: number;
    action: string;
    operations: readonly Pick<SignedOperation, "signer" | "callData" | "signerAccount">[];
    enabled?: boolean;
  },
): Promise<void> {
  if (parameters.enabled === false || parameters.operations.length === 0) return;
  const { chainId } = config.getChainConfig(parameters.chainId);

  const resolved = await Promise.all(
    parameters.operations.map(async (operation) => ({
      operation,
      account: await getCachedDelegatorAccount(config, chainId, operation.signerAccount.addr),
    })),
  );

  const checks = new Map<string, DelegationCheck>();
  for (const { operation, account } of resolved) {
    const key = `${operation.signer.toLowerCase()}:${account.toLowerCase()}`;
    const check = checks.get(key) ?? { signer: operation.signer, account, selectors: new Set<Hex>() };
    check.selectors.add(operation.callData.slice(0, 10).toLowerCase() as Hex);
    checks.set(key, check);
  }

  const results = await Promise.all(
    [...checks.values()].map(async (check) => ({
      ...check,
      missing: await findUndelegatedGaslessSelectors(config, {
        chainId,
        signer: check.signer,
        signerAccount: check.account,
        selectors: [...check.selectors],
      }),
    })),
  );
  const undelegated = results.filter((result) => result.missing.length > 0);
  if (undelegated.length === 0) return;

  const detail = undelegated
    .map(
      (result) =>
        `signer ${result.signer} holds no active InstantLayer delegation from sub-account ${result.account} for selector(s) ${result.missing.join(", ")}`,
    )
    .join("; ");
  throw new SymmError(
    "validation",
    "INSTANT_SIGNER_NOT_DELEGATED",
    `${parameters.action}: ${detail}. Grant those selectors to the signer (getInstantTradeRequiredSelectors builds the trade set), sign with the sub-account's owner, or pass \`preflightDelegation: false\` to skip this check.`,
  );
}
