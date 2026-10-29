import { SymmError } from "../../shared/errors/symm-error";
import type { GrantDelegationsEntry } from "./actions/grant-delegations";
import type { InstantLayerAccount } from "./types";

/** The part of a multi-delegate grant the contract validates up front. */
interface GrantDelegationsInput {
  account: InstantLayerAccount;
  delegations: readonly GrantDelegationsEntry[];
}

/**
 * Throw before any wallet prompt for a grant the contract always reverts.
 *
 * @param input - The granting account and its delegate entries.
 * @throws {SymmError} `GRANT_DELEGATIONS_EMPTY` for an empty list, `GRANT_DELEGATIONS_PARTYB_UNSUPPORTED` for a PartyB account.
 *
 * @internal
 */
export function assertGrantDelegationsInput(input: GrantDelegationsInput) {
  if (input.delegations.length === 0)
    throw new SymmError(
      "validation",
      "GRANT_DELEGATIONS_EMPTY",
      "grantDelegations needs at least one delegation. The contract reverts InvalidDelegation on an empty list.",
    );
  if (input.account.isPartyB)
    throw new SymmError(
      "validation",
      "GRANT_DELEGATIONS_PARTYB_UNSUPPORTED",
      "grantDelegations only accepts a PartyA account; the contract reverts InvalidDelegation for PartyB. Use grantDelegation for a PartyB grant.",
    );
}

/**
 * Build the contract's `DelegationInfo[]`, every entry pinned to the one
 * granting account.
 *
 * @param input - The granting account and its delegate entries.
 * @returns The struct array `InstantLayer.grantDelegations` takes.
 *
 * @internal
 */
export function toDelegationInfos(input: GrantDelegationsInput) {
  return input.delegations.map(({ delegatedSigner, selectors, expiryTimestamp }) => ({
    account: input.account,
    delegatedSigner,
    selectors,
    expiryTimestamp,
  }));
}
