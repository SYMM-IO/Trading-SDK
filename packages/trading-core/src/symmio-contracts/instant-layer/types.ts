import type { Address } from "viem";

/**
 * Instant Layer account identity used by delegation calls.
 *
 * @example
 * ```ts
 * const account = { addr: "0xaccount…", isPartyB: false };
 * ```
 */
export interface InstantLayerAccount {
  /** Account, subaccount, virtual account, or PartyB address. */
  addr: Address;
  /** Whether the account is a PartyB account. PartyA/user accounts should pass `false`. */
  isPartyB: boolean;
}
