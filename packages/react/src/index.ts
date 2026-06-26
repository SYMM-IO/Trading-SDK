/**
 * `@theoldvarorg/react` — React adapter for the SYMMIO SDK.
 *
 * Mirrors wagmi's react layer: a {@link SymmioProvider} supplies the core
 * `Config` (its viem clients sourced from the host's wagmi config), and thin
 * hooks read it via `useSymmioConfig` / `useSymmioChainId` before delegating to
 * `@theoldvarorg/core`'s query/mutation option factories. Every hook normalizes
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
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  INSTANT_TRADE_REQUIRED_SELECTORS,
  OrderType,
  PositionType,
  QuoteStatus,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
  SubAccountIsolationType,
  SymmApiError,
  SymmError,
  VIRTUAL_ACCOUNT_ISOLATION_TYPE,
  calculateClosePrice,
  calculateTradeParams,
  clampClosePrecision,
  validateInstantCloseAgainstMarket,
  validateInstantOpenAgainstMarket,
  type CalculateClosePriceParameters,
  type CalculateTradeParamsParameters,
  type CalculateTradeParamsReturnType,
  type ClampClosePrecisionParameters,
  type CloseQuoteConstraintViolation,
  type InstantCloseMarketData,
  type InstantCloseOrder,
  type InstantCloseParameters,
  type InstantCloseReturnType,
  type PrepareInstantCloseParameters,
  type QuoteConstraintViolation,
  type SubAccountCreationData,
  type SymmErrorKind,
  type ValidateInstantCloseAgainstMarketParameters,
  type ValidateInstantCloseAgainstMarketReturnType,
  type ValidateInstantOpenAgainstMarketParameters,
  type ValidateInstantOpenAgainstMarketReturnType,
  type VirtualAccountDetail,
  type VirtualAccountIsolationType,
} from "@theoldvarorg/core";
export type { GetWalletClientFn, SymmioWalletClient } from "@theoldvarorg/core";
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
 * React-query wrappers over the `@theoldvarorg/core` AccountLayer slice.
 * Mutations invalidate the relevant queries on success.
 */
export {
  useAccountBalanceInfo,
  useAccountBalanceOf,
  useAddMargin,
  useAllocate,
  useCreateSubAccounts,
  useDeallocate,
  useDeleteSubAccount,
  useDeposit,
  useDepositAndAllocate,
  useEditAccountName,
  usePredictedNextVirtualAccount,
  useRemoveMargin,
  useSimulateAddMargin,
  useSimulateAllocate,
  useSimulateCreateSubAccounts,
  useSimulateDeallocate,
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
  useVirtualAccount,
  useVirtualAccountsAddressesOfSubAccount,
  type AddMarginResult,
  type AllocateResult,
  type CreateSubAccountsResult,
  type DeallocateResult,
  type DeallocateVariables,
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
  type UseDeallocateParameters,
  type UseDeallocateReturnType,
  type UseDeleteSubAccountParameters,
  type UseDeleteSubAccountReturnType,
  type UseDepositAndAllocateParameters,
  type UseDepositAndAllocateReturnType,
  type UseDepositParameters,
  type UseDepositReturnType,
  type UseEditAccountNameParameters,
  type UseEditAccountNameReturnType,
  type UsePredictedNextVirtualAccountParameters,
  type UsePredictedNextVirtualAccountReturnType,
  type UseRemoveMarginParameters,
  type UseRemoveMarginReturnType,
  type UseSimulateAddMarginParameters,
  type UseSimulateAddMarginReturnType,
  type UseSimulateAllocateParameters,
  type UseSimulateAllocateReturnType,
  type UseSimulateCreateSubAccountsParameters,
  type UseSimulateCreateSubAccountsReturnType,
  type UseSimulateDeallocateParameters,
  type UseSimulateDeallocateReturnType,
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
  type UseVirtualAccountParameters,
  type UseVirtualAccountReturnType,
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
  useInstantClose,
  useInstantCloseAuto,
  useInstantCloses,
  useInstantOpen,
  useInstantOpenAuto,
  useInstantOpenQuoteId,
  useInstantOpens,
  useIsDelegationActive,
  useSimulateGrantDelegation,
  type GrantDelegationResult,
  type UseDelegationExpiryParameters,
  type UseDelegationExpiryReturnType,
  type UseGrantDelegationParameters,
  type UseGrantDelegationReturnType,
  type UseInstantCloseAutoParameters,
  type UseInstantCloseAutoReturnType,
  type UseInstantCloseParameters,
  type UseInstantCloseReturnType,
  type UseInstantClosesParameters,
  type UseInstantClosesReturnType,
  type UseInstantOpenAutoParameters,
  type UseInstantOpenAutoReturnType,
  type UseInstantOpenParameters,
  type UseInstantOpenQuoteIdParameters,
  type UseInstantOpenQuoteIdReturnType,
  type UseInstantOpenReturnType,
  type UseInstantOpensParameters,
  type UseInstantOpensReturnType,
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
 * Solver error-code hooks
 * -----------------------
 * Fetch the solver's `/error_codes` map and resolve a single numeric code (e.g.
 * the `errorCode` on a failed open/close notification) to its message.
 */
export {
  useSolverErrorCodes,
  useSolverErrorMessage,
  type UseSolverErrorCodesParameters,
  type UseSolverErrorCodesReturnType,
} from "./error-codes";

/**
 * Quote hooks
 * -----------
 * Read open positions and quotes from the SYMMIO core. `usePartyAOpenPositions`
 * returns full `Quote` structs; `usePartyAPendingQuotes` returns pending quote
 * ids to hydrate with `useQuote`. `useManagedQuotes` orchestrates every source
 * (on-chain reads fanned out across the sub-account's Virtual Accounts + hedger
 * instant-ops + live notifications) into one reconciled, lifecycle-tagged table,
 * seeded by the optimistic `useOptimisticQuotesStore`. Import the `UnifiedQuote`
 * / `QuoteLifecycle` value types from `@theoldvarorg/core`.
 */
export {
  useAccountLiquidationPrice,
  useGroupedQuotes,
  useManagedQuotes,
  useOptimisticQuotesStore,
  usePartyAOpenPositions,
  usePartyAPendingQuotes,
  useQuote,
  useQuotePlatformFee,
  useQuoteUpnlAndPnl,
  useQuoteHistory,
  useSubgraphQuery,
  type ManagedQuotesSources,
  type OptimisticQuotesStoreState,
  type UseAccountLiquidationPriceParameters,
  type UseAccountLiquidationPriceReturnType,
  type UseGroupedQuotesParameters,
  type UseGroupedQuotesResult,
  type UseManagedQuotesParameters,
  type UseManagedQuotesResult,
  type UsePartyAOpenPositionsParameters,
  type UsePartyAOpenPositionsReturnType,
  type UsePartyAPendingQuotesParameters,
  type UsePartyAPendingQuotesReturnType,
  type UseQuoteHistoryParameters,
  type UseQuoteHistoryReturnType,
  type UseQuoteParameters,
  type UseQuotePlatformFeeParameters,
  type UseQuotePlatformFeeReturnType,
  type UseQuoteReturnType,
  type UseQuoteUpnlAndPnlParameters,
  type UseQuoteUpnlAndPnlReturnType,
  type UseSubgraphQueryParameters,
  type UseSubgraphQueryReturnType,
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
  useEnigmaPriceByMarketId,
  useEnigmaPriceByName,
  useEnigmaPriceServiceSymbolsInfo,
  useEnigmaPrices,
  type UseEnigmaPriceByMarketIdParameters,
  type UseEnigmaPriceByMarketIdReturnType,
  type UseEnigmaPriceByNameParameters,
  type UseEnigmaPriceByNameReturnType,
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
  type UseEnigmaPricesParameters,
  type UseEnigmaPricesReturnType,
} from "./price-service";

/**
 * WebSocket / notifications hooks
 * -------------------------------
 * Subscribe to the chain's live notifications stream. Import the notification
 * value types (`Notification`, `NotificationType`, `SocketStatus`) from
 * `@theoldvarorg/core`.
 */
export { useNotifications, type UseNotificationsParameters, type UseNotificationsReturnType } from "./websocket";

/**
 * Notification search hooks
 * -------------------------
 * `useSearchNotifications` queries the notification service's free-form
 * `POST /api/v1/search` endpoint (the REST counterpart to the live
 * `useNotifications` stream). Import the filter/result value types
 * (`NotificationSearchFilter`, `NotificationDocument`, `NotificationSearchResult`)
 * from `@theoldvarorg/core`.
 */
export {
  useSearchNotifications,
  type UseSearchNotificationsParameters,
  type UseSearchNotificationsReturnType,
} from "./notifications";

/**
 * Muon hooks
 * ----------
 * Fetch the Muon uPnL signature `removeMargin` requires, on demand. `useRemoveMargin`
 * already does this internally; use this hook only for the raw signature.
 */
export {
  useDeallocateUpnlSig,
  useMuonPartyAOverview,
  useMuonPrice,
  useMuonPriceRange,
  useMuonSettleUpnl,
  useMuonUpnl,
  useMuonUpnlA,
  useMuonUpnlAWithSymbolPrice,
  useMuonUpnlB,
  useMuonUpnlWithSymbolPrice,
  type UseDeallocateUpnlSigParameters,
  type UseDeallocateUpnlSigReturnType,
  type UseMuonPartyAOverviewParameters,
  type UseMuonPartyAOverviewReturnType,
  type UseMuonPriceParameters,
  type UseMuonPriceRangeParameters,
  type UseMuonPriceRangeReturnType,
  type UseMuonPriceReturnType,
  type UseMuonSettleUpnlParameters,
  type UseMuonSettleUpnlReturnType,
  type UseMuonUpnlAParameters,
  type UseMuonUpnlAReturnType,
  type UseMuonUpnlAWithSymbolPriceParameters,
  type UseMuonUpnlAWithSymbolPriceReturnType,
  type UseMuonUpnlBParameters,
  type UseMuonUpnlBReturnType,
  type UseMuonUpnlParameters,
  type UseMuonUpnlReturnType,
  type UseMuonUpnlWithSymbolPriceParameters,
  type UseMuonUpnlWithSymbolPriceReturnType,
} from "./muon";

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
