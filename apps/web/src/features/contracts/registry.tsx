import type { ComponentType } from "react";
import { ReadAccountBalanceInfo } from "../inspector/read-account-balance-info";
import { ReadAccountBalanceOf } from "../inspector/read-account-balance-of";
import { ReadCollateralAllowance } from "../inspector/read-collateral-allowance";
import { ReadCollateralBalance } from "../inspector/read-collateral-balance";
import { ReadDeallocateUpnlSig } from "../inspector/read-deallocate-upnl-sig";
import { ReadDelegationReads } from "../inspector/read-delegation-reads";
import { ReadFeeForUser } from "../inspector/read-fee-for-user";
import { ReadGetFundingFeesOfPartyB } from "../inspector/read-get-funding-fees-of-party-b";
import { ReadGetPartyAOpenPositions } from "../inspector/read-get-party-a-open-positions";
import { ReadGetPartyAPendingQuotes } from "../inspector/read-get-party-a-pending-quotes";
import { ReadGetQuote } from "../inspector/read-get-quote";
import { ReadGetSubAccount } from "../inspector/read-get-sub-account";
import { ReadGetSubAccountVirtualNonce } from "../inspector/read-get-sub-account-virtual-nonce";
import { ReadGetSubAccountsCountOfUser } from "../inspector/read-get-sub-accounts-count-of-user";
import { ReadGetUserSubAccounts } from "../inspector/read-get-user-sub-accounts";
import { ReadGetUserSubAccountsAddresses } from "../inspector/read-get-user-sub-accounts-addresses";
import { ReadGetVirtualAccount } from "../inspector/read-get-virtual-account";
import { ReadGetVirtualAccountsAddressesOfSubAccount } from "../inspector/read-get-virtual-accounts-addresses-of-sub-account";
import { ReadGetWithdrawRequest } from "../inspector/read-get-withdraw-request";
import { ReadLastWithdrawRequestId } from "../inspector/read-last-withdraw-request-id";
import { ReadOnchainContractMarkets } from "../inspector/read-onchain-contract-markets";
import { ReadPendingWithdrawRequests } from "../inspector/read-pending-withdraw-requests";
import { ReadQuotePriceHistory } from "../inspector/read-quote-price-history";
import { ReadWithdrawableTime } from "../inspector/read-withdrawable-time";
import { WriteAddMargin } from "../inspector/write-add-margin";
import { WriteAllocate } from "../inspector/write-allocate";
import { WriteApproveCollateral } from "../inspector/write-approve-collateral";
import { WriteCreateSubAccounts } from "../inspector/write-create-sub-accounts";
import { WriteDeallocate } from "../inspector/write-deallocate";
import { WriteDeleteSubAccount } from "../inspector/write-delete-sub-account";
import { WriteDeposit } from "../inspector/write-deposit";
import { WriteDepositAndAllocate } from "../inspector/write-deposit-and-allocate";
import { WriteEditAccountName } from "../inspector/write-edit-account-name";
import { WriteFinalizeWithdrawRequest } from "../inspector/write-finalize-withdraw-request";
import { WriteGrantDelegation } from "../inspector/write-grant-delegation";
import { WriteInitiateWithdraw } from "../inspector/write-initiate-withdraw";
import { WriteRemoveMargin } from "../inspector/write-remove-margin";
import { WriteRequestCancelWithdraw } from "../inspector/write-request-cancel-withdraw";
import { BalanceHistoryCard } from "../transactions/balance-history-card";
import { TransfersCard } from "../transactions/transfers-card";

/** On-chain ABI a method belongs to. Solver (API) reads have no ABI. */
export type AbiKey = "account-layer" | "symmio-core" | "collateral" | "instant-layer";

/** Usability flow a method participates in. */
export type GroupKey = "subaccounts" | "deposit" | "margin" | "withdraw" | "delegation" | "positions" | "transfers";

/** One registered method-exerciser card with its taxonomy. */
export interface MethodEntry {
  /** The method's name. Its card renders with the DOM id `method-<id>`, the anchor search lands on. */
  id: string;
  /** The card's title, when it is not {@link MethodEntry.id} itself. */
  title?: string;
  /** One line on what the card does, written for a search result. */
  summary: string;
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
  {
    id: "getSubAccount",
    summary: "Read one subaccount by its address.",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetSubAccount,
  },
  {
    id: "getSubAccountVirtualNonce",
    summary: "A subaccount's Virtual Account nonce, which seeds the next VA address.",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetSubAccountVirtualNonce,
  },
  {
    id: "getSubAccountsCountOfUser",
    summary: "How many subaccounts an address owns.",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetSubAccountsCountOfUser,
  },
  {
    id: "getUserSubAccounts",
    summary: "Every subaccount a user owns.",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetUserSubAccounts,
  },
  {
    id: "getUserSubAccountsAddresses",
    summary: "Every subaccount address a user owns.",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: ReadGetUserSubAccountsAddresses,
  },
  {
    id: "getVirtualAccount",
    summary: "A Virtual Account's parent, market, isolation type and metadata.",
    kind: "read",
    abi: "account-layer",
    groups: ["positions"],
    Component: ReadGetVirtualAccount,
  },
  {
    id: "getVirtualAccountsAddressesOfSubAccount",
    summary: "A subaccount's Virtual Account addresses.",
    kind: "read",
    abi: "account-layer",
    groups: ["subaccounts", "positions"],
    Component: ReadGetVirtualAccountsAddressesOfSubAccount,
  },
  {
    id: "getAccountBalanceOf",
    summary: "A subaccount's balance on its SYMMIO core.",
    kind: "read",
    abi: "symmio-core",
    groups: ["subaccounts"],
    Component: ReadAccountBalanceOf,
  },
  {
    id: "getAccountBalanceInfo",
    summary: "A subaccount's full balance breakdown on its SYMMIO core.",
    kind: "read",
    abi: "symmio-core",
    groups: ["subaccounts"],
    Component: ReadAccountBalanceInfo,
  },
  {
    id: "getFeeForUser",
    summary: "Open and close fee rates for an account and symbol.",
    kind: "read",
    abi: "symmio-core",
    groups: [],
    Component: ReadFeeForUser,
  },
  {
    id: "getOnchainContractMarkets",
    summary: "The markets registered on the SYMMIO core, page by page.",
    kind: "read",
    abi: "symmio-core",
    groups: [],
    Component: ReadOnchainContractMarkets,
  },
  // SYMMIO core — quotes & positions
  {
    id: "getPartyAOpenPositions",
    summary: "A partyA's open positions.",
    kind: "read",
    abi: "symmio-core",
    groups: ["positions"],
    Component: ReadGetPartyAOpenPositions,
  },
  {
    id: "getPartyAPendingQuotes",
    summary: "A partyA's pending quote ids.",
    kind: "read",
    abi: "symmio-core",
    groups: ["positions"],
    Component: ReadGetPartyAPendingQuotes,
  },
  {
    id: "getQuote",
    summary: "One quote by its id.",
    kind: "read",
    abi: "symmio-core",
    groups: ["positions"],
    Component: ReadGetQuote,
  },
  {
    id: "getFundingFeesOfPartyB",
    summary: "A solver's accumulated funding state for one symbol.",
    kind: "read",
    abi: "symmio-core",
    groups: ["positions"],
    Component: ReadGetFundingFeesOfPartyB,
  },
  {
    id: "getQuotePriceHistory",
    title: "getQuoteEventsByType",
    summary: "A quote's open-price recomputes and funding ticks, newest first.",
    kind: "read",
    groups: ["positions"],
    Component: ReadQuotePriceHistory,
  },
  {
    id: "createSubAccounts",
    summary: "Create a subaccount for the connected wallet.",
    kind: "write",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: WriteCreateSubAccounts,
  },
  {
    id: "editAccountName",
    summary: "Rename one of your subaccounts.",
    kind: "write",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: WriteEditAccountName,
  },
  {
    id: "deleteSubAccount",
    summary: "Permanently delete one of your subaccounts.",
    kind: "write",
    abi: "account-layer",
    groups: ["subaccounts"],
    Component: WriteDeleteSubAccount,
  },
  // InstantLayer — delegation
  {
    id: "delegationReads",
    title: "delegations / isDelegationActive",
    summary: "Delegation expiry and active status for an account, delegate and function.",
    kind: "read",
    abi: "instant-layer",
    groups: ["delegation"],
    Component: ReadDelegationReads,
  },
  {
    id: "grantDelegation",
    summary: "Grant a delegate access to selected Instant Layer functions.",
    kind: "write",
    abi: "instant-layer",
    groups: ["delegation"],
    Component: WriteGrantDelegation,
  },
  // AccountLayer — deposits
  {
    id: "depositForAccount",
    summary: "Deposit collateral into a subaccount.",
    kind: "write",
    abi: "account-layer",
    groups: ["deposit"],
    Component: WriteDeposit,
  },
  {
    id: "depositAndAllocateForAccount",
    summary: "Deposit collateral and allocate it as trading margin in one transaction.",
    kind: "write",
    abi: "account-layer",
    groups: ["deposit"],
    Component: WriteDepositAndAllocate,
  },
  // Balance history (analytics subgraph) — a deposit/withdraw read, not an ABI method
  {
    id: "balanceHistory",
    title: "useBalanceHistory",
    summary: "A subaccount's deposit and withdrawal history.",
    kind: "read",
    groups: ["deposit", "withdraw"],
    Component: BalanceHistoryCard,
  },
  // Transfer history (events subgraph) — internal transfers, not an ABI method
  {
    id: "transferHistory",
    title: "useTransferHistory",
    summary: "A subaccount's internal margin transfers.",
    kind: "read",
    groups: ["transfers"],
    Component: TransfersCard,
  },
  // Collateral (ERC20)
  {
    id: "approveCollateral",
    summary: "Approve the collateral token for the SYMMIO core, before a deposit.",
    kind: "write",
    abi: "collateral",
    groups: ["deposit"],
    Component: WriteApproveCollateral,
  },
  {
    id: "getCollateralAllowance",
    summary: "How much collateral an owner has approved the SYMMIO core to spend.",
    kind: "read",
    abi: "collateral",
    groups: ["deposit"],
    Component: ReadCollateralAllowance,
  },
  {
    id: "getCollateralBalance",
    summary: "An address's balance of the collateral token.",
    kind: "read",
    abi: "collateral",
    groups: ["deposit"],
    Component: ReadCollateralBalance,
  },
  // SYMMIO core + AccountLayer — margin
  {
    id: "allocate",
    summary: "Move available balance into trading margin.",
    kind: "write",
    abi: "symmio-core",
    groups: ["margin"],
    Component: WriteAllocate,
  },
  {
    id: "deallocate",
    summary: "Move trading margin back into available balance.",
    kind: "write",
    abi: "symmio-core",
    groups: ["margin"],
    Component: WriteDeallocate,
  },
  {
    id: "addMargin",
    summary: "Add margin to a Virtual Account from its parent subaccount.",
    kind: "write",
    abi: "account-layer",
    groups: ["margin"],
    Component: WriteAddMargin,
  },
  {
    id: "removeMargin",
    summary: "Remove margin from a Virtual Account.",
    kind: "write",
    abi: "account-layer",
    groups: ["margin"],
    Component: WriteRemoveMargin,
  },
  // Muon oracle (off-chain API) — uPnL signature for removeMargin
  {
    id: "getDeallocateUpnlSig",
    summary: "The Muon uPnL signature that removing margin requires.",
    kind: "read",
    groups: ["margin"],
    Component: ReadDeallocateUpnlSig,
  },
  // SYMMIO core — withdraw system
  {
    id: "initiateWithdraw",
    summary: "Open a withdraw request for a subaccount.",
    kind: "write",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: WriteInitiateWithdraw,
  },
  {
    id: "finalizeWithdrawRequest",
    summary: "Pay out a withdraw request once its cooldown has passed.",
    kind: "write",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: WriteFinalizeWithdrawRequest,
  },
  {
    id: "requestCancelWithdraw",
    summary: "Cancel a pending withdraw request.",
    kind: "write",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: WriteRequestCancelWithdraw,
  },
  {
    id: "getPendingWithdrawRequests",
    summary: "A subaccount's active withdraw requests.",
    kind: "read",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: ReadPendingWithdrawRequests,
  },
  {
    id: "getWithdrawRequests",
    summary: "One withdraw request, by subaccount and request id.",
    kind: "read",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: ReadGetWithdrawRequest,
  },
  {
    id: "getLastWithdrawRequestId",
    summary: "A subaccount's most recent withdraw request id.",
    kind: "read",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: ReadLastWithdrawRequestId,
  },
  {
    id: "getWithdrawableTime",
    summary: "The earliest time a withdrawal started now could be finalized.",
    kind: "read",
    abi: "symmio-core",
    groups: ["withdraw"],
    Component: ReadWithdrawableTime,
  },
];
