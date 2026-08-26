/**
 * `@symmio/trading-react` — React adapter for the SYMMIO SDK.
 *
 * Mirrors wagmi's react layer: a {@link SymmioProvider} supplies the core
 * `Config` (its viem clients sourced from the host's wagmi config), and thin
 * hooks read it via `useSymmioConfig` / `useSymmioChainId` before delegating to
 * `@symmio/trading-core`'s query/mutation option factories. Every hook normalizes
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
  NotificationType,
  OrderType,
  PositionType,
  QuoteStatus,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
  SubAccountIsolationType,
  SymmApiError,
  SymmError,
  VIRTUAL_ACCOUNT_ISOLATION_TYPE,
  calculateAvailableForOrder,
  calculateAvailableInstantOpenMargin,
  calculateClosePrice,
  calculatePriceImpact,
  calculateQuotePnl,
  calculateTradeParams,
  clampClosePrecision,
  decimalPriceToWei,
  getPartyAOpenPositionsQueryKey,
  getPartyAOpenPositionsQueryOptions,
  isolationTypeForSide,
  supportsEstimatedPrice,
  validateInstantCloseAgainstMarket,
  validateInstantOpenAgainstMarket,
  type CalculateAvailableInstantOpenMarginParameters,
  type CalculateClosePriceParameters,
  type CalculateTradeParamsParameters,
  type CalculateTradeParamsReturnType,
  type ClampClosePrecisionParameters,
  type CloseQuoteConstraintViolation,
  type GetPartyAOpenPositionsData,
  type GetPartyAOpenPositionsOptions,
  type GetPartyAOpenPositionsParameters,
  type GetPartyAOpenPositionsQueryKey,
  type GetPartyAOpenPositionsQueryOptions,
  type GetPartyAOpenPositionsReturnType,
  type InstantCloseBulkAutoOrder,
  type InstantCloseBulkAutoParameters,
  type InstantCloseBulkOrder,
  type InstantCloseBulkParameters,
  type InstantCloseBulkReturnType,
  type InstantCloseConstraintFields,
  type InstantCloseMarketData,
  type InstantCloseOrder,
  type InstantCloseParameters,
  type InstantCloseReturnType,
  type InstantOpenConstraintFields,
  type Notification,
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
} from "@symmio/trading-core";
export type { GetWalletClientFn, SymmioWalletClient } from "@symmio/trading-core";
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
 * React-query wrappers over the `@symmio/trading-core` AccountLayer slice.
 * Mutations invalidate the relevant queries on success.
 */
export {
  useAccountBalanceInfo,
  useAccountBalanceOf,
  useAddMargin,
  useAffiliateState,
  useAllocate,
  useCancelRegistration,
  useCreateSubAccounts,
  useDeallocate,
  useDeallocateAndInitiateWithdraw,
  useDeleteSubAccount,
  useDeposit,
  useDepositAndAllocate,
  useEditAccountName,
  useGeneratedAccountManagerAddress,
  usePredictedNextVirtualAccount,
  useRemoveMargin,
  useRequestToRegisterAffiliate,
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
  type CancelRegistrationResult,
  type CreateSubAccountsResult,
  type DeallocateAndInitiateWithdrawResult,
  type DeallocateAndInitiateWithdrawVariables,
  type DeallocateResult,
  type DeallocateVariables,
  type DeleteSubAccountResult,
  type DepositAndAllocateResult,
  type DepositResult,
  type EditAccountNameResult,
  type RemoveMarginResult,
  type RemoveMarginVariables,
  type RequestToRegisterAffiliateResult,
  type UseAccountBalanceInfoParameters,
  type UseAccountBalanceInfoReturnType,
  type UseAccountBalanceOfParameters,
  type UseAccountBalanceOfReturnType,
  type UseAddMarginParameters,
  type UseAddMarginReturnType,
  type UseAffiliateStateParameters,
  type UseAffiliateStateReturnType,
  type UseAllocateParameters,
  type UseAllocateReturnType,
  type UseCancelRegistrationParameters,
  type UseCancelRegistrationReturnType,
  type UseCreateSubAccountsParameters,
  type UseCreateSubAccountsReturnType,
  type UseDeallocateAndInitiateWithdrawParameters,
  type UseDeallocateAndInitiateWithdrawReturnType,
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
  type UseGeneratedAccountManagerAddressParameters,
  type UseGeneratedAccountManagerAddressReturnType,
  type UsePredictedNextVirtualAccountParameters,
  type UsePredictedNextVirtualAccountReturnType,
  type UseRemoveMarginParameters,
  type UseRemoveMarginReturnType,
  type UseRequestToRegisterAffiliateParameters,
  type UseRequestToRegisterAffiliateReturnType,
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
  useInstantCloseBulk,
  useInstantCloseBulkAuto,
  useInstantCloses,
  useInstantOpen,
  useInstantOpenAuto,
  useInstantOpenQuoteId,
  useInstantOpenWithTpSl,
  useInstantOpens,
  useIsDelegationActive,
  useLimitCloseAuto,
  useLimitOpenAuto,
  useSimulateGrantDelegation,
  type GrantDelegationResult,
  type UseDelegationExpiryParameters,
  type UseDelegationExpiryReturnType,
  type UseGrantDelegationParameters,
  type UseGrantDelegationReturnType,
  type UseInstantCloseAutoParameters,
  type UseInstantCloseAutoReturnType,
  type UseInstantCloseBulkAutoParameters,
  type UseInstantCloseBulkAutoReturnType,
  type UseInstantCloseBulkParameters,
  type UseInstantCloseBulkReturnType,
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
  type UseInstantOpenWithTpSlData,
  type UseInstantOpenWithTpSlParameters,
  type UseInstantOpenWithTpSlPhase,
  type UseInstantOpenWithTpSlReturnType,
  type UseInstantOpenWithTpSlVariables,
  type UseInstantOpensParameters,
  type UseInstantOpensReturnType,
  type UseIsDelegationActiveParameters,
  type UseIsDelegationActiveReturnType,
  type UseLimitCloseAutoParameters,
  type UseLimitCloseAutoReturnType,
  type UseLimitOpenAutoParameters,
  type UseLimitOpenAutoReturnType,
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
  useWithdraw,
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
  type UseWithdrawParameters,
  type UseWithdrawRequestParameters,
  type UseWithdrawRequestReturnType,
  type UseWithdrawReturnType,
  type UseWithdrawVariables,
  type UseWithdrawableTimeParameters,
  type UseWithdrawableTimeReturnType,
  type WithdrawResult,
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
 * / `QuoteLifecycle` value types from `@symmio/trading-core`. The
 * `useQuoteGroupFunding*` hooks read a whole group's settled-to-date funding —
 * one aggregate total, one merged timeline — where `netReceived = received −
 * paid`, so a **positive** value means the group **earned** funding.
 * `useQuoteGroupMarginRisk` describes a group's margin, equity and distance to
 * liquidation; it withholds `metrics` when the group spans several accounts,
 * since each is liquidated independently.
 */
export {
  useAccountLiquidationPrice,
  useAccountUpnl,
  useCloseQuoteGroup,
  useCoolDownsOfMA,
  useForceCancelCloseRequest,
  useForceCancelQuote,
  useForceClose,
  useForceCloseEligibility,
  useForceCloseParams,
  useGroupedQuotes,
  useLimitOrders,
  useManagedQuotes,
  useOptimisticQuotesStore,
  usePartyAOpenPositions,
  usePartyAPendingQuotes,
  useQuote,
  useQuoteEventsByType,
  useQuoteFunding,
  useQuoteGroupFunding,
  useQuoteGroupFundingHistory,
  useQuoteGroupMarginRisk,
  useQuoteHistory,
  useQuotePlatformFee,
  useQuotePriceHistory,
  useQuoteUpnlAndPnl,
  useQuotesFunding,
  useRequestToCancelCloseRequest,
  useRequestToCancelQuote,
  useSubgraphQuery,
  type CloseQuoteGroupParameters,
  type CloseQuoteGroupStatus,
  type CloseQuoteGroupStep,
  type CloseQuoteGroupStepStatus,
  type CloseQuoteGroupSummary,
  type ForceCancelCloseRequestResult,
  type ForceCancelQuoteResult,
  type ForceCloseEligibilityQuote,
  type ForceCloseResult,
  type ManagedQuotesSources,
  type OptimisticQuotesStoreState,
  type QuotesFundingInputQuote,
  type RequestToCancelCloseRequestResult,
  type RequestToCancelQuoteResult,
  type UseAccountLiquidationPriceParameters,
  type UseAccountLiquidationPriceReturnType,
  type UseAccountUpnlParameters,
  type UseAccountUpnlReturnType,
  type UseCloseQuoteGroupParameters,
  type UseCloseQuoteGroupReturnType,
  type UseCoolDownsOfMAParameters,
  type UseCoolDownsOfMAReturnType,
  type UseForceCancelCloseRequestParameters,
  type UseForceCancelCloseRequestReturnType,
  type UseForceCancelQuoteParameters,
  type UseForceCancelQuoteReturnType,
  type UseForceCloseEligibilityParameters,
  type UseForceCloseEligibilityReturnType,
  type UseForceCloseParameters,
  type UseForceCloseParamsParameters,
  type UseForceCloseParamsReturnType,
  type UseForceCloseReturnType,
  type UseGroupedQuotesParameters,
  type UseGroupedQuotesResult,
  type UseLimitOrdersParameters,
  type UseLimitOrdersReturnType,
  type UseManagedQuotesParameters,
  type UseManagedQuotesResult,
  type UsePartyAOpenPositionsParameters,
  type UsePartyAOpenPositionsReturnType,
  type UsePartyAPendingQuotesParameters,
  type UsePartyAPendingQuotesReturnType,
  type UseQuoteEventsByTypeParameters,
  type UseQuoteEventsByTypeReturnType,
  type UseQuoteFundingParameters,
  type UseQuoteFundingReturnType,
  type UseQuoteGroupFundingHistoryParameters,
  type UseQuoteGroupFundingHistoryReturnType,
  type UseQuoteGroupFundingParameters,
  type UseQuoteGroupFundingReturnType,
  type UseQuoteGroupMarginRiskParameters,
  type UseQuoteGroupMarginRiskReturnType,
  type UseQuoteHistoryParameters,
  type UseQuoteHistoryReturnType,
  type UseQuoteParameters,
  type UseQuotePlatformFeeParameters,
  type UseQuotePlatformFeeReturnType,
  type UseQuotePriceHistoryParameters,
  type UseQuoteReturnType,
  type UseQuoteUpnlAndPnlParameters,
  type UseQuoteUpnlAndPnlReturnType,
  type UseQuotesFundingParameters,
  type UseQuotesFundingReturnType,
  type UseRequestToCancelCloseRequestParameters,
  type UseRequestToCancelCloseRequestReturnType,
  type UseRequestToCancelQuoteParameters,
  type UseRequestToCancelQuoteReturnType,
  type UseSubgraphQueryParameters,
  type UseSubgraphQueryReturnType,
} from "./quotes";

/**
 * Margin — derived spendable-margin helpers for the trade form, plus
 * `useAccountMarginRisk`: one account's margin, equity and distance to
 * liquidation, folded by core's `calculateMarginRisk`. Every figure it returns
 * describes a single liquidation domain, so call it once per account rather than
 * summing across them.
 */
export {
  useAccountMarginRisk,
  useAvailableInstantOpenMargin,
  type UseAccountMarginRiskParameters,
  type UseAccountMarginRiskReturnType,
  type UseAvailableInstantOpenMarginParameters,
  type UseAvailableInstantOpenMarginReturnType,
} from "./margin";

/**
 * Balance history hooks
 * ---------------------
 * `useBalanceHistory` reads a sub-account's deposit / withdraw history from the
 * analytics subgraph (`getBalanceHistory`), with internal margin-transfer legs
 * excluded by default. `useDepositHistory` / `useWithdrawHistory` are thin
 * wrappers that pin the movement filter. Import the `BalanceChangeType` /
 * `BalanceHistoryFilter` / `MarginTransferType` enums and `BalanceHistoryRow`
 * type from `@symmio/trading-core`.
 */
export {
  useBalanceHistory,
  useDepositHistory,
  useWithdrawHistory,
  type UseBalanceHistoryParameters,
  type UseBalanceHistoryReturnType,
  type UseDepositHistoryParameters,
  type UseWithdrawHistoryParameters,
} from "./balance-history";

/**
 * Transfer history hook
 * ---------------------
 * `useTransferHistory` reads internal transfers (margin moves between SYMMIO
 * accounts) from the events subgraph (`getTransferHistory`). Import the
 * `TransferRow` / `TransferDirection` types from `@symmio/trading-core`.
 */
export { useTransferHistory, type UseTransferHistoryParameters, type UseTransferHistoryReturnType } from "./transfers";

/**
 * Locked params hooks
 * -------------------
 * Fetch solver lock percentages for a market/leverage pair.
 */
export { useLockedParams, type UseLockedParamsParameters, type UseLockedParamsReturnType } from "./locked-params";

/**
 * Notional cap hooks
 * ------------------
 * Read per-market available liquidity from the solver, polled every 15 s by
 * default. Caller controls the polling cadence (or disables it).
 */
export {
  DEFAULT_NOTIONAL_CAP_POLLING_MS,
  useNotionalCapAll,
  useNotionalCapBySymbolId,
  useOpenInterestBySymbolId,
  type UseNotionalCapAllParameters,
  type UseNotionalCapAllReturnType,
  type UseNotionalCapBySymbolIdParameters,
  type UseNotionalCapBySymbolIdReturnType,
  type UseOpenInterestBySymbolIdParameters,
  type UseOpenInterestBySymbolIdReturnType,
} from "./notional-cap";

/**
 * Funding-info hooks
 * ------------------
 * Read per-market funding rates (next-epoch long/short), next funding time, and
 * epoch length from the solver. Does not poll by default; the caller opts into
 * polling via `query.refetchInterval`.
 */
export {
  useEstimatedPrice,
  type UseEstimatedPriceParameters,
  type UseEstimatedPriceReturnType,
} from "./estimated-price";
export { useFundingInfo, type UseFundingInfoParameters, type UseFundingInfoReturnType } from "./funding-info";
export {
  useRevenueRecords,
  type UseRevenueRecordsParameters,
  type UseRevenueRecordsReturnType,
} from "./revenue-records";
export { useSymbols, type UseSymbolsParameters, type UseSymbolsReturnType } from "./symbols";
export { useTradeVolume, type UseTradeVolumeParameters, type UseTradeVolumeReturnType } from "./trade-volume";

/**
 * Market-info hooks
 * -----------------
 * Read per-market 24h trading volume and lifetime value, plus the aggregate
 * totals, from the solver. Does not poll by default; the caller opts into
 * polling via `query.refetchInterval`.
 */
export { useMarketInfo, type UseMarketInfoParameters, type UseMarketInfoReturnType } from "./market-info";

/**
 * Solver capabilities & revenue
 * -----------------------------
 * Gate flows/UI on what the resolved solver supports (e.g. group close), and
 * read its revenue totals — protocol-wide by default, or one market via
 * `symbolId`.
 */
export {
  useSolverCapabilities,
  useSolverRevenue,
  useSupportsGroupClose,
  useSupportsLimitOrder,
  useSupportsListingService,
  type UseSolverCapabilitiesParameters,
  type UseSolverRevenueParameters,
  type UseSolverRevenueReturnType,
} from "./solvers";

/**
 * Fee hooks
 * ---------
 * Read SYMMIO fee settings for a user/account, affiliate, and symbol id.
 */
export { useFeeForUser, type UseFeeForUserParameters, type UseFeeForUserReturnType } from "./fees";

/**
 * Mark-price hooks
 * ----------------
 * Provider-agnostic prices: each of these resolves whichever price provider
 * serves the target solver — Enigma's lowcap service, or Binance USD-M Futures
 * for major markets — so a component never branches on provider.
 *
 * `usePrices` subscribes to the live feed and returns both the ergonomic
 * `prices` map and the full `ticks` map (narrow on `provider` for Binance's
 * `indexPrice`). `usePriceByName` tracks one market with re-render gating;
 * `usePriceByMarketId` does the same from a solver `symbol_id`.
 * `useMarkPrices` is the one-shot REST read.
 *
 * Pass `names` on Binance: its stream pushes every listed symbol once per
 * second, and the filter is what keeps that from churning your component tree.
 */
export {
  useMarkPrices,
  usePriceByMarketId,
  usePriceByName,
  usePrices,
  type UseMarkPricesParameters,
  type UseMarkPricesReturnType,
  type UsePriceByMarketIdParameters,
  type UsePriceByMarketIdReturnType,
  type UsePriceByNameParameters,
  type UsePriceByNameReturnType,
  type UsePricesParameters,
  type UsePricesRestFallback,
  type UsePricesReturnType,
} from "./price-service";

/**
 * Binance-only price hooks
 * ------------------------
 * Provider-specific twins of the mark-price hooks, for callers that already know
 * their source. Every tick is a `BinanceMarkPriceTick`, so `indexPrice` and the
 * Binance funding fields are reachable without narrowing. Each surfaces
 * `UNSUPPORTED_BY_PRICE_SERVICE` when the target solver is not priced by Binance.
 */
export {
  useBinanceHealth,
  useBinancePremiumIndex,
  useBinancePrices,
  useBinanceSymbolsInfo,
  type UseBinanceHealthParameters,
  type UseBinanceHealthReturnType,
  type UseBinancePremiumIndexParameters,
  type UseBinancePremiumIndexReturnType,
  type UseBinancePricesParameters,
  type UseBinancePricesReturnType,
  type UseBinanceSymbolsInfoParameters,
  type UseBinanceSymbolsInfoReturnType,
} from "./price-service";

/**
 * Price-service hooks (Enigma-specific)
 * -------------------------------------
 * Read Enigma price-service prices, metadata, symbols info, and health. These
 * throw `UNSUPPORTED_BY_PRICE_SERVICE` on a chain whose provider is not Enigma.
 */
export {
  useEnigmaPriceByMarketId,
  useEnigmaPriceByName,
  useEnigmaPriceServiceHealth,
  useEnigmaPriceServiceMetadata,
  useEnigmaPriceServicePricesByAddresses,
  useEnigmaPriceServicePricesByNames,
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
 * `@symmio/trading-core`.
 */
export { useNotifications, type UseNotificationsParameters, type UseNotificationsReturnType } from "./websocket";

/**
 * Notification search hooks
 * -------------------------
 * `useSearchNotifications` is one hook over both solver kinds, dispatched by
 * `solverId`: an enigma solver hits the notification service (`POST /api/v1/search`),
 * a rasa solver hits its own position-state endpoint. It returns a per-kind union
 * (narrow on `data.kind`) and is the REST counterpart to the live
 * `useNotifications` stream. Import the filter/result value types
 * (`NotificationSearchFilter`, `NotificationDocument`, `NotificationSearchResult`,
 * `EnigmaNotificationSearchResult`, `RasaNotificationSearchResult`) from `@symmio/trading-core`.
 */
export {
  useSearchNotifications,
  type UseSearchNotificationsParameters,
  type UseSearchNotificationsReturnType,
} from "./notifications";

/**
 * Muon hooks
 * ----------
 * Fetch Muon attestations on demand. The three `…Sig` hooks return
 * contract-ready structs (`SingleUpnlSig` for `removeMargin`,
 * `SingleUpnlAndPriceSig` for `sendQuote`, `HighLowPriceSig` for force-close);
 * the `useMuon…` hooks return the raw normalized attestations. `useRemoveMargin`
 * and `useInstantOpen` already fetch their signatures internally — reach for
 * these only when you drive the calldata yourself.
 *
 * All of them are **mutations**, not queries: attestations are timestamped and
 * short-lived, so they must be fetched on an explicit action, not on mount.
 */
export {
  useDeallocateUpnlSig,
  useForceClosePriceSig,
  useMuonPartyAOverview,
  useMuonPrice,
  useMuonPriceRange,
  useMuonSettleUpnl,
  useMuonUpnl,
  useMuonUpnlA,
  useMuonUpnlAWithSymbolPrice,
  useMuonUpnlB,
  useMuonUpnlWithSymbolPrice,
  useSendQuoteUpnlSig,
  type UseDeallocateUpnlSigParameters,
  type UseDeallocateUpnlSigReturnType,
  type UseForceClosePriceSigParameters,
  type UseForceClosePriceSigReturnType,
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
  type UseSendQuoteUpnlSigParameters,
  type UseSendQuoteUpnlSigReturnType,
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

/**
 * TP/SL hooks + helpers
 * ---------------------
 * Phase 1 — on-chain enigma quotes. Read TP/SL via REST + WS overlay, write new
 * orders via session-key EIP-712 signing. Pure helpers re-exported from
 * `@symmio/trading-core` so consumers can stay on one dependency.
 */
export {
  DEFAULT_TPSL_SLIPPAGE_LOWCAPS,
  GROUP_TPSL_SIDES,
  ZERO_LEG,
  buildConditionalOrderLeg,
  buildConditionalOrderMessage,
  buildTpSlDeleteMessage,
  childNotional,
  deleteQuoteTpSl,
  deleteQuoteTpSlMutationOptions,
  estimateGroupTpSlReturn,
  generateTpSlSalt,
  parseTpSlFrame,
  planGroupTpSl,
  planGroupTpSlDelete,
  priceSlippageCalculation,
  sharePercent,
  signTpSlRequest,
  summarizeQuoteGroupTpSl,
  toGroupTpSlChildren,
  toGroupTpSlOrders,
  toSignableTpSlMessage,
  validateTpSl,
  watchTpSlNotifications,
  type DeleteQuoteTpSlParameters,
  type DeleteQuoteTpSlReturnType,
  type EstimateGroupTpSlReturnParameters,
  type GroupTpSlAction,
  type GroupTpSlChild,
  type GroupTpSlDeleteScope,
  type GroupTpSlDeleteSkip,
  type GroupTpSlDeleteTarget,
  type GroupTpSlDesiredMap,
  type GroupTpSlDesiredSide,
  type GroupTpSlDesiredSides,
  type GroupTpSlOrder,
  type GroupTpSlReturnEstimate,
  type GroupTpSlReturnLeg,
  type GroupTpSlSideDisplay,
  type GroupTpSlSideKey,
  type GroupTpSlSideSummary,
  type GroupTpSlSkipReason,
  type PlanGroupTpSlDeleteResult,
  type PlanGroupTpSlParameters,
  type PlanGroupTpSlResult,
  type QuoteGroupTpSlSummary,
  type QuoteTpSl,
  type QuoteTpSlActionPriceType,
  type QuoteTpSlConditionalOrderType,
  type QuoteTpSlRow,
  type QuoteTpSlRowState,
  type SetTpSlSide,
  type TpSlConditionalOrderLeg,
  type TpSlConditionalOrderMessage,
  type TpSlConditionalOrderType,
  type TpSlConfig,
  type TpSlDeleteMessage,
  type TpSlInfoState,
  type TpSlNotification,
  type TpSlPriceType,
  type TpSlSignedRequest,
  type TpSlSigningSpec,
  type TpSlValidation,
  type UnwatchTpSl,
  type ValidateTpSlInputs,
  type WatchTpSlNotificationsParameters,
} from "@symmio/trading-core";
export {
  invalidateTpSlReads,
  toQuoteTpSl,
  useDeleteQuoteGroupTpSl,
  useDeleteQuoteTpSl,
  useQuoteGroupTpSl,
  useQuoteGroupTpSlEditor,
  useQuoteTpSl,
  useSetQuoteGroupTpSl,
  useSetQuoteTpSl,
  useTpSlConfig,
  useTpSlRecord,
  useTpSlRecords,
  useTpSlSigningSpec,
  useTpSlStore,
  useTpSlSupported,
  useWatchTpSlNotifications,
  type DeleteQuoteGroupTpSlParameters,
  type DeleteQuoteGroupTpSlStatus,
  type DeleteQuoteGroupTpSlStep,
  type DeleteQuoteGroupTpSlStepStatus,
  type DeleteQuoteGroupTpSlSummary,
  type SetQuoteGroupTpSlParameters,
  type SetQuoteGroupTpSlStatus,
  type SetQuoteGroupTpSlStep,
  type SetQuoteGroupTpSlStepKind,
  type SetQuoteGroupTpSlStepStatus,
  type SetQuoteGroupTpSlSummary,
  type TpSlRecord,
  type TpSlStoreState,
  type UseDeleteQuoteGroupTpSlParameters,
  type UseDeleteQuoteGroupTpSlReturnType,
  type UseDeleteQuoteTpSlParameters,
  type UseDeleteQuoteTpSlReturnType,
  type UseQuoteGroupTpSlEditorParameters,
  type UseQuoteGroupTpSlEditorReturnType,
  type UseQuoteGroupTpSlParameters,
  type UseQuoteGroupTpSlReturnType,
  type UseQuoteTpSlParameters,
  type UseQuoteTpSlReturnType,
  type UseSetQuoteGroupTpSlParameters,
  type UseSetQuoteGroupTpSlReturnType,
  type UseSetQuoteTpSlParameters,
  type UseSetQuoteTpSlReturnType,
  type UseTpSlConfigParameters,
  type UseTpSlConfigReturnType,
  type UseTpSlSigningSpecParameters,
  type UseTpSlSigningSpecReturnType,
  type UseTpSlSupportedParameters,
  type UseWatchTpSlNotificationsParameters,
  type UseWatchTpSlNotificationsReturnType,
} from "./tpsl";

/**
 * Candles / charting hooks
 * ------------------------
 * Chart data decoupled from any chart library. `useBinanceCandleSource` builds
 * a stable source, `useCandles` reads its history through TanStack Query, and
 * `useCandleStream` subscribes to live bars. `useTradingViewDatafeed` adapts a
 * source to TradingView's Charting Library; any other library consumes the same
 * two data hooks directly. Import the value types (`Candle`, `CandleResolution`,
 * `CandleSource`) from `@symmio/trading-core`.
 */
export {
  useBinanceCandleSource,
  useCandleStream,
  useCandles,
  useTradingViewDatafeed,
  type UseBinanceCandleSourceParameters,
  type UseCandleStreamParameters,
  type UseCandleStreamReturnType,
  type UseCandlesParameters,
  type UseCandlesReturnType,
  type UseTradingViewDatafeedParameters,
} from "./candles";

/**
 * Orderbook hooks
 * ---------------
 * Market depth decoupled from any venue. `useBinanceOrderbookSource` builds a
 * stable source; `useLiveOrderbook` is the one most ladders want — a
 * synchronized book, grouped onto a tick, with cumulative depth and the spread
 * already derived. `useOrderbookStream` exposes the raw synchronized book for
 * custom aggregation, and `useOrderbook` reads a one-off snapshot through
 * TanStack Query.
 *
 * The book behind these is not a stream of deltas applied on faith: the source
 * verifies that every update chains onto the last and rebuilds from a fresh
 * snapshot when one does not, surfaced as `isResyncing` / `resyncReason` so a
 * stale ladder can say so. Import the value types (`Orderbook`,
 * `OrderbookLevel`, `OrderbookSource`) from `@symmio/trading-core`.
 */
export {
  useBinanceOrderbookSource,
  useLiveOrderbook,
  useOrderbook,
  useOrderbookStream,
  type UseBinanceOrderbookSourceParameters,
  type UseLiveOrderbookParameters,
  type UseLiveOrderbookReturnType,
  type UseOrderbookParameters,
  type UseOrderbookReturnType,
  type UseOrderbookStreamParameters,
  type UseOrderbookStreamReturnType,
} from "./orderbook";

/* Rasa-only solver hooks
 * ----------------------
 * Hooks over the endpoints only the `rasa` solver kind exposes: solver-side
 * balance info, partyA uPnL, global open interest, symbol price range,
 * single error-code lookup, whitelist check/add, and readiness. Each surfaces a
 * typed `UNSUPPORTED_BY_SOLVER` error when the resolved solver is not a `rasa`
 * solver. (Notification history search is the unified `useSearchNotifications`.)
 */
export {
  useAddSolverWhitelist,
  useErrorMessage,
  usePartyAUpnl,
  useSolverBalanceInfo,
  useSolverOpenInterest,
  useSolverPriceRange,
  useSolverReadiness,
  type UseAddSolverWhitelistParameters,
  type UseAddSolverWhitelistReturnType,
  type UseErrorMessageParameters,
  type UseErrorMessageReturnType,
  type UsePartyAUpnlParameters,
  type UsePartyAUpnlReturnType,
  type UseSolverBalanceInfoParameters,
  type UseSolverBalanceInfoReturnType,
  type UseSolverOpenInterestParameters,
  type UseSolverOpenInterestReturnType,
  type UseSolverPriceRangeParameters,
  type UseSolverPriceRangeReturnType,
  type UseSolverReadinessParameters,
  type UseSolverReadinessReturnType,
} from "./rasa-solver";
/**
 * Pools (lowcap liquidity markets)
 * --------------------------------
 * The pool catalogue served by the listing backend. Search, filter, sort and
 * pagination are all server-side, so every parameter change is a new request
 * rather than a re-view of an already-fetched page.
 */
export {
  useAuthenticateListing,
  useListingMarkets,
  useUserListingMarkets,
  type AuthenticateListingVariables,
  type UseAuthenticateListingParameters,
  type UseAuthenticateListingReturnType,
  type UseListingMarketsParameters,
  type UseListingMarketsReturnType,
  type UseUserListingMarketsParameters,
  type UseUserListingMarketsReturnType,
} from "./pools";
/**
 * Inventory service
 * -----------------
 * The custody backend behind the Pools. `useInventoryTvl` reads the system-wide
 * custodial TVL as an 18-decimal `bigint` — the headline TVL on a pools page,
 * and not the same thing as summing the catalogue's per-pool values.
 */
export { useInventoryTvl, type UseInventoryTvlParameters, type UseInventoryTvlReturnType } from "./inventory";
