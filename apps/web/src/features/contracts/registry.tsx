import type { ComponentType } from "react";
import { ReadAccountBalanceInfo } from "../inspector/read-account-balance-info";
import { ReadAccountBalanceOf } from "../inspector/read-account-balance-of";
import { ReadCollateralAllowance } from "../inspector/read-collateral-allowance";
import { ReadCollateralBalance } from "../inspector/read-collateral-balance";
import { ReadDeallocateUpnlSig } from "../inspector/read-deallocate-upnl-sig";
import { ReadDelegationReads } from "../inspector/read-delegation-reads";
import { ReadFeeForUser } from "../inspector/read-fee-for-user";
import { ReadGetPartyAOpenPositions } from "../inspector/read-get-party-a-open-positions";
import { ReadGetPartyAPendingQuotes } from "../inspector/read-get-party-a-pending-quotes";
import { ReadGetQuote } from "../inspector/read-get-quote";
import { ReadGetSubAccount } from "../inspector/read-get-sub-account";
import { ReadGetSubAccountVirtualNonce } from "../inspector/read-get-sub-account-virtual-nonce";
import { ReadGetSubAccountsCountOfUser } from "../inspector/read-get-sub-accounts-count-of-user";
import { ReadGetUserSubAccounts } from "../inspector/read-get-user-sub-accounts";
import { ReadGetUserSubAccountsAddresses } from "../inspector/read-get-user-sub-accounts-addresses";
import { ReadGetVirtualAccountsAddressesOfSubAccount } from "../inspector/read-get-virtual-accounts-addresses-of-sub-account";
import { ReadGetWithdrawRequest } from "../inspector/read-get-withdraw-request";
import { ReadLastWithdrawRequestId } from "../inspector/read-last-withdraw-request-id";
import { ReadOnchainContractMarkets } from "../inspector/read-onchain-contract-markets";
import { ReadPendingWithdrawRequests } from "../inspector/read-pending-withdraw-requests";
import { ReadWithdrawableTime } from "../inspector/read-withdrawable-time";
import { WriteAddMargin } from "../inspector/write-add-margin";
import { WriteAllocate } from "../inspector/write-allocate";
import { WriteApproveCollateral } from "../inspector/write-approve-collateral";
import { WriteCreateSubAccounts } from "../inspector/write-create-sub-accounts";
import { WriteDeposit } from "../inspector/write-deposit";
import { WriteDepositAndAllocate } from "../inspector/write-deposit-and-allocate";
import { WriteEditAccountName } from "../inspector/write-edit-account-name";
import { WriteFinalizeWithdrawRequest } from "../inspector/write-finalize-withdraw-request";
import { WriteGrantDelegation } from "../inspector/write-grant-delegation";
import { WriteInitiateWithdraw } from "../inspector/write-initiate-withdraw";
import { WriteRemoveMargin } from "../inspector/write-remove-margin";
import { WriteRequestCancelWithdraw } from "../inspector/write-request-cancel-withdraw";

/** On-chain ABI a method belongs to. Solver (API) reads have no ABI. */
export type AbiKey = "account-layer" | "symmio-core" | "collateral" | "instant-layer";

/** Usability flow a method participates in. */
export type GroupKey = "subaccounts" | "deposit" | "margin" | "withdraw" | "delegation" | "positions";

/** One registered method-exerciser card with its taxonomy. */
export interface MethodEntry {
  id: string;
  kind: "read" | "write";
  /** The ABI this method is called against, or `undefined` for solver/API reads. */
  abi?: AbiKey;
  /** Usability flows the method appears under. */
  groups: GroupKey[];
  Component: ComponentType;
}

/**
 * The single registry of contract-method cards. The Contracts hub and every
 * method page derive their contents from this list — an ABI page filters by
 * {@link MethodEntry.abi}, a flow page by {@link MethodEntry.groups} — so a method
 * is authored once and surfaced in both views.
 */
export const METHOD_REGISTRY: readonly MethodEntry[] = [
  // AccountLayer — subaccounts
  { id: "getSubAccount", kind: "read", abi: "account-layer", groups: ["subaccounts"], Component: ReadGetSubAccount },
  {
    id: "getSubAccountVirtualNonce",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetSubAccountVirtualNonce,
  },
  {
    id: "getSubAccountsCountOfUser",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetSubAccountsCountOfUser,
  },
  {
    id: "getUserSubAccounts",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetUserSubAccounts,
  },
  {
    id: "getUserSubAccountsAddresses",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetUserSubAccountsAddresses,
  },
  {
    id: "getVirtualAccountsAddressesOfSubAccount",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts", "positions"],
    Component: ReadGetVirtualAccountsAddressesOfSubAccount,
  },
  {
    id: "getAccountBalanceOf",
    kind: "read",
    abi: "symmio-core",
    groups: ["subaccounts"],
    Component: ReadAccountBalanceOf,
  },
  {
    id: "getAccountBalanceInfo",
    kind: "read",
    abi: "symmio-core",
    groups: ["subaccounts"],
    Component: ReadAccountBalanceInfo,
  },
  {
    id: "getFeeForUser",
    kind: "read",
    abi: "symmio-core",
    groups: [],
    Component: ReadFeeForUser,
  },
  {
    id: "getOnchainContractMarkets",
    kind: "read",
    abi: "symmio-core",
    groups: [],
    Component: ReadOnchainContractMarkets,
  },
  // SYMMIO core — quotes & positions
  {
    id: "getPartyAOpenPositions",
    kind: "read",
    abi: "symmio-core",
    groups: ["positions"],
    Component: ReadGetPartyAOpenPositions,
  },
  {
    id: "getPartyAPendingQuotes",
    kind: "read",
    abi: "symmio-core",
    groups: ["positions"],
    Component: ReadGetPartyAPendingQuotes,
  },
  {
    id: "getQuote",
    kind: "read",
    abi: "symmio-core",
    groups: ["positions"],
    Component: ReadGetQuote,
  },
  {
    id: "createSubAccounts",
    kind: "write",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: WriteCreateSubAccounts,
  },
  {
    id: "editAccountName",
    kind: "write",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: WriteEditAccountName,
  },
  // InstantLayer — delegation
  {
    id: "delegationReads",
    kind: "read",
    abi: "instant-layer",
    groups: ["delegation"],
    Component: ReadDelegationReads,
  },
  {
    id: "grantDelegation",
    kind: "write",
    abi: "instant-layer",
    groups: ["delegation"],
    Component: WriteGrantDelegation,
  },
  // AccountLayer — deposits
  { id: "depositForAccount", kind: "write", abi: "account-layer", groups: ["deposit"], Component: WriteDeposit },
  {
    id: "depositAndAllocateForAccount",
    kind: "write",
    abi: "account-layer",
    groups: ["deposit"],
    Component: WriteDepositAndAllocate,
  },
  // Collateral (ERC20)
  { id: "approveCollateral", kind: "write", abi: "collateral", groups: ["deposit"], Component: WriteApproveCollateral },
  {
    id: "getCollateralAllowance",
    kind: "read",
    abi: "collateral",
    groups: ["deposit"],
    Component: ReadCollateralAllowance,
  },
  {
    id: "getCollateralBalance",
    kind: "read",
    abi: "collateral",
    groups: ["deposit"],
    Component: ReadCollateralBalance,
  },
  // SYMMIO core + AccountLayer — margin
  { id: "allocate", kind: "write", abi: "symmio-core", groups: ["margin"], Component: WriteAllocate },
  { id: "addMargin", kind: "write", abi: "account-layer", groups: ["margin"], Component: WriteAddMargin },
  { id: "removeMargin", kind: "write", abi: "account-layer", groups: ["margin"], Component: WriteRemoveMargin },
  // Muon oracle (off-chain API) — uPnL signature for removeMargin
  { id: "getDeallocateUpnlSig", kind: "read", groups: ["margin"], Component: ReadDeallocateUpnlSig },
  // SYMMIO core — withdraw system
  { id: "initiateWithdraw", kind: "write", abi: "symmio-core", groups: ["withdraw"], Component: WriteInitiateWithdraw },
  {
    id: "finalizeWithdrawRequest",
    kind: "write",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: WriteFinalizeWithdrawRequest,
  },
  {
    id: "requestCancelWithdraw",
    kind: "write",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: WriteRequestCancelWithdraw,
  },
  {
    id: "getPendingWithdrawRequests",
    kind: "read",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: ReadPendingWithdrawRequests,
  },
  {
    id: "getWithdrawRequests",
    kind: "read",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: ReadGetWithdrawRequest,
  },
  {
    id: "getLastWithdrawRequestId",
    kind: "read",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: ReadLastWithdrawRequestId,
  },
  {
    id: "getWithdrawableTime",
    kind: "read",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: ReadWithdrawableTime,
  },
];
