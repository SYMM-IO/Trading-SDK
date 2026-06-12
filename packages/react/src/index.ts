/**
 * `@symm-frontier/react` — React adapter for the SYMMIO SDK.
 *
 * Mirrors wagmi's react layer: a {@link SymmioProvider} supplies the core
 * `Config` (its viem clients sourced from the host's wagmi config), and thin
 * hooks read it via `useSymmioConfig` / `useSymmioChainId` before delegating to
 * `@symm-frontier/core`'s query/mutation option factories. Every hook normalizes
 * failures to the same `SymmioRequestError`.
 *
 * @remarks
 * Every re-export below is **explicit** rather than `export *`, so adding a
 * symbol to a slice barrel does not automatically publish it from the root.
 */

/**
 * Provider & config access
 * ------------------------
 * Mount `SymmioProvider` inside a `WagmiProvider` and `QueryClientProvider`.
 * `useSymmioConfig` / `useSymmioChainId` are the wagmi-style primitives every
 * other hook builds on.
 */
export {
  SymmioProvider,
  useSymmioChainId,
  useSymmioConfig,
  type SymmioProviderProps,
  type UseSymmioConfigParameters,
} from "./provider";

/**
 * Wallet
 * ------
 * Hooks for reading and managing the connected wallet through the SDK.
 */
export {
  useConnectWallet,
  useDisconnectWallet,
  useSwitchToSymmioChain,
  useWalletAccount,
  type UseConnectWalletResult,
  type UseDisconnectWalletResult,
  type UseSwitchToSymmioChainResult,
  type UseWalletAccountResult,
} from "./wallet";

/**
 * AccountLayer hooks
 * ------------------
 * React-query wrappers over the `@symm-frontier/core` AccountLayer slice.
 * Mutations invalidate the relevant queries on success.
 */
export {
  useAccountBalanceInfo,
  useAccountBalanceOf,
  useAddMargin,
  useAllocate,
  useCreateSubAccounts,
  useDeleteSubAccount,
  useDeposit,
  useDepositAndAllocate,
  useEditAccountName,
  useRemoveMargin,
  useSimulateAddMargin,
  useSimulateAllocate,
  useSimulateCreateSubAccounts,
  useSimulateDeleteSubAccount,
  useSimulateDeposit,
  useSimulateDepositAndAllocate,
  useSimulateEditAccountName,
  useSimulateRemoveMargin,
  useSubAccount,
  useSubAccountVirtualNonce,
  useSubAccountsCountOfUser,
  useUserSubAccounts,
  useUserSubAccountsAddresses,
  useVirtualAccountsAddressesOfSubAccount,
  type AddMarginResult,
  type AllocateResult,
  type CreateSubAccountsResult,
  type DeleteSubAccountResult,
  type DepositAndAllocateResult,
  type DepositResult,
  type EditAccountNameResult,
  type RemoveMarginResult,
  type RemoveMarginVariables,
  type UseAccountBalanceInfoParameters,
  type UseAccountBalanceInfoReturnType,
  type UseAccountBalanceOfParameters,
  type UseAccountBalanceOfReturnType,
  type UseAddMarginParameters,
  type UseAddMarginReturnType,
  type UseAllocateParameters,
  type UseAllocateReturnType,
  type UseCreateSubAccountsParameters,
  type UseCreateSubAccountsReturnType,
  type UseDeleteSubAccountParameters,
  type UseDeleteSubAccountReturnType,
  type UseDepositAndAllocateParameters,
  type UseDepositAndAllocateReturnType,
  type UseDepositParameters,
  type UseDepositReturnType,
  type UseEditAccountNameParameters,
  type UseEditAccountNameReturnType,
  type UseRemoveMarginParameters,
  type UseRemoveMarginReturnType,
  type UseSimulateAddMarginParameters,
  type UseSimulateAddMarginReturnType,
  type UseSimulateAllocateParameters,
  type UseSimulateAllocateReturnType,
  type UseSimulateCreateSubAccountsParameters,
  type UseSimulateCreateSubAccountsReturnType,
  type UseSimulateDeleteSubAccountParameters,
  type UseSimulateDeleteSubAccountReturnType,
  type UseSimulateDepositAndAllocateParameters,
  type UseSimulateDepositAndAllocateReturnType,
  type UseSimulateDepositParameters,
  type UseSimulateDepositReturnType,
  type UseSimulateEditAccountNameParameters,
  type UseSimulateEditAccountNameReturnType,
  type UseSimulateRemoveMarginParameters,
  type UseSimulateRemoveMarginReturnType,
  type UseSubAccountParameters,
  type UseSubAccountReturnType,
  type UseSubAccountVirtualNonceParameters,
  type UseSubAccountVirtualNonceReturnType,
  type UseSubAccountsCountOfUserParameters,
  type UseSubAccountsCountOfUserReturnType,
  type UseUserSubAccountsAddressesParameters,
  type UseUserSubAccountsAddressesReturnType,
  type UseUserSubAccountsParameters,
  type UseUserSubAccountsReturnType,
  type UseVirtualAccountsAddressesOfSubAccountParameters,
  type UseVirtualAccountsAddressesOfSubAccountReturnType,
} from "./account-layer";

/**
 * Collateral hooks
 * ----------------
 * Approve the collateral token for the SYMMIO core (the deposit prerequisite) and
 * read the connected wallet's allowance and balance.
 */
export {
  useApproveCollateral,
  useCollateralAllowance,
  useCollateralBalance,
  useSimulateApproveCollateral,
  type ApproveCollateralResult,
  type UseApproveCollateralParameters,
  type UseApproveCollateralReturnType,
  type UseCollateralAllowanceParameters,
  type UseCollateralAllowanceReturnType,
  type UseCollateralBalanceParameters,
  type UseCollateralBalanceReturnType,
  type UseSimulateApproveCollateralParameters,
  type UseSimulateApproveCollateralReturnType,
} from "./collateral";

/**
 * InstantLayer hooks
 * ------------------
 * Delegated signer access reads and grant writes for the Instant Layer
 * contract.
 */
export {
  useDelegationExpiry,
  useGrantDelegation,
  useIsDelegationActive,
  useSimulateGrantDelegation,
  type GrantDelegationResult,
  type UseDelegationExpiryParameters,
  type UseDelegationExpiryReturnType,
  type UseGrantDelegationParameters,
  type UseGrantDelegationReturnType,
  type UseIsDelegationActiveParameters,
  type UseIsDelegationActiveReturnType,
  type UseSimulateGrantDelegationParameters,
  type UseSimulateGrantDelegationReturnType,
} from "./instant-layer";

/**
 * Withdraw hooks
 * --------------
 * The request-based withdraw flow: initiate / cancel / finalize mutations (the
 * write wrappers hide the AccountLayer `_call` proxying) plus the read views for
 * pending requests, ids, and the withdrawable time.
 */
export {
  useFinalizeWithdrawRequest,
  useInitiateWithdraw,
  useLastWithdrawRequestId,
  usePendingWithdrawRequests,
  useRequestCancelWithdraw,
  useSimulateFinalizeWithdrawRequest,
  useSimulateInitiateWithdraw,
  useSimulateRequestCancelWithdraw,
  useWithdrawRequest,
  useWithdrawableTime,
  type FinalizeWithdrawRequestResult,
  type InitiateWithdrawResult,
  type RequestCancelWithdrawResult,
  type UseFinalizeWithdrawRequestParameters,
  type UseFinalizeWithdrawRequestReturnType,
  type UseInitiateWithdrawParameters,
  type UseInitiateWithdrawReturnType,
  type UseLastWithdrawRequestIdParameters,
  type UseLastWithdrawRequestIdReturnType,
  type UsePendingWithdrawRequestsParameters,
  type UsePendingWithdrawRequestsReturnType,
  type UseRequestCancelWithdrawParameters,
  type UseRequestCancelWithdrawReturnType,
  type UseSimulateFinalizeWithdrawRequestParameters,
  type UseSimulateFinalizeWithdrawRequestReturnType,
  type UseSimulateInitiateWithdrawParameters,
  type UseSimulateInitiateWithdrawReturnType,
  type UseSimulateRequestCancelWithdrawParameters,
  type UseSimulateRequestCancelWithdrawReturnType,
  type UseWithdrawRequestParameters,
  type UseWithdrawRequestReturnType,
  type UseWithdrawableTimeParameters,
  type UseWithdrawableTimeReturnType,
} from "./withdraw";

/**
 * Markets hooks
 * -------------
 * Fetch tradable markets from the solver and on-chain contract markets from
 * SYMMIO core.
 */
export {
  useMarkets,
  useOnchainContractMarkets,
  type UseMarketsParameters,
  type UseMarketsReturnType,
  type UseOnchainContractMarketsParameters,
  type UseOnchainContractMarketsReturnType,
} from "./markets";

/**
 * Quote hooks
 * -----------
 * Read open positions and quotes from the SYMMIO core. `usePartyAOpenPositions`
 * returns full `Quote` structs; `usePartyAPendingQuotes` returns pending quote
 * ids to hydrate with `useQuote`.
 */
export {
  usePartyAOpenPositions,
  usePartyAPendingQuotes,
  useQuote,
  type UsePartyAOpenPositionsParameters,
  type UsePartyAOpenPositionsReturnType,
  type UsePartyAPendingQuotesParameters,
  type UsePartyAPendingQuotesReturnType,
  type UseQuoteParameters,
  type UseQuoteReturnType,
} from "./quotes";

/**
 * Locked params hooks
 * -------------------
 * Fetch solver lock percentages for a market/leverage pair.
 */
export { useLockedParams, type UseLockedParamsParameters, type UseLockedParamsReturnType } from "./locked-params";

/**
 * Fee hooks
 * ---------
 * Read SYMMIO fee settings for a user/account, affiliate, and symbol id.
 */
export { useFeeForUser, type UseFeeForUserParameters, type UseFeeForUserReturnType } from "./fees";

/**
 * Price-service hooks
 * -------------------
 * Read Enigma price-service prices, metadata, symbols info, and health.
 */
export {
  useEnigmaPriceServiceHealth,
  useEnigmaPriceServiceMetadata,
  useEnigmaPriceServicePricesByAddresses,
  useEnigmaPriceServicePricesByNames,
  useEnigmaPriceServiceSymbolsInfo,
  type UseEnigmaPriceServiceHealthParameters,
  type UseEnigmaPriceServiceHealthReturnType,
  type UseEnigmaPriceServiceMetadataParameters,
  type UseEnigmaPriceServiceMetadataReturnType,
  type UseEnigmaPriceServicePricesByAddressesParameters,
  type UseEnigmaPriceServicePricesByAddressesReturnType,
  type UseEnigmaPriceServicePricesByNamesParameters,
  type UseEnigmaPriceServicePricesByNamesReturnType,
  type UseEnigmaPriceServiceSymbolsInfoParameters,
  type UseEnigmaPriceServiceSymbolsInfoReturnType,
} from "./price-service";

/**
 * Muon hooks
 * ----------
 * Fetch the Muon uPnL signature `removeMargin` requires, on demand. `useRemoveMargin`
 * already does this internally; use this hook only for the raw signature.
 */
export { useDeallocateUpnlSig, type UseDeallocateUpnlSigParameters, type UseDeallocateUpnlSigReturnType } from "./muon";

/**
 * Query helpers
 * -------------
 * Turn a core query-key factory into an `invalidateQueries` predicate that
 * matches on a field subset (e.g. every subaccount query for one user).
 */
export { predicateMatch } from "./utils";

/**
 * Errors
 * ------
 * Normalized error type every SDK hook surfaces, plus the classifier the hooks
 * use internally. UIs branch on `error.kind`.
 */
export {
  SymmioRequestError,
  normalizeSymmError,
  type SymmioNormalizedErrorKind,
  type SymmioRequestErrorOptions,
} from "./errors";

/**
 * Transactions
 * ------------
 * Shared shape for write hooks (`WriteParameters` / `WriteResult`), plus an
 * optional zustand store for tracking in-flight tx hashes in the UI.
 */
export {
  useTransactionsStore,
  type TrackedTx,
  type TransactionsStoreState,
  type WriteParameters,
  type WriteResult,
} from "./transactions";
