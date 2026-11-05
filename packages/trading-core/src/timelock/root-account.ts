import { isAddress, isAddressEqual, zeroAddress, type Address } from "viem";
import type { VirtualAccountDetail } from "../symmio-contracts/account-layer/actions/get-virtual-account";

/**
 * Resolve the timelock family root from a Virtual Account detail.
 *
 * @param account - The queried account address.
 * @param detail - The AccountLayer Virtual Account detail.
 * @returns The retained parent for a live or deleted VA, otherwise `account`.
 * @remarks AccountLayer can retain `parentAccount` after deletion, so `isExists` must not decide family ownership.
 */
export function resolveTimelockFamilyAccount(
  account: Address,
  detail: Pick<VirtualAccountDetail, "parentAccount"> | { parentAccount?: Address },
): Address {
  return !detail.parentAccount || !isAddress(detail.parentAccount) || isAddressEqual(detail.parentAccount, zeroAddress)
    ? account
    : detail.parentAccount;
}
