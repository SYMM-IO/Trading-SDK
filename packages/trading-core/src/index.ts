/**
 * `@symmio/trading-core` — framework-agnostic SYMMIO SDK.
 *
 * a single immutable {@link Config} (created with
 * {@link createConfig}) is the first argument of every standalone action
 * (`getMarkets(config, params)`), and each read/write ships a matching TanStack
 * Query / Mutation options factory (`getMarketsQueryOptions(config, options)`).
 * `core` depends on viem for contracts, axios for REST APIs, and
 * `@tanstack/query-core` for query option types — no framework. Framework
 * layers (`@symmio/trading-react`, a future Vue layer) inject the viem-client
 * resolvers the config needs.
 *
 * @remarks
 * Every re-export below uses **explicit named exports**, not `export *`, so the
 * package root is the single curated public surface. Adding a symbol to a slice
 * barrel does not auto-publish it; it must be listed here.
 */

/**
 * ABI fragments
 * -------------
 * Raw viem-style `Abi` arrays for SYMMIO contracts, for consumers who call viem
 * directly (e.g. `readContract({ abi: accountLayerAbi })`).
 */
export { accountLayerAbi } from "./symmio-contracts/abi/v0.8.5/account-layer";
export { instantLayerAbi } from "./symmio-contracts/abi/v0.8.5/instant-layer";
export { symmioAbi } from "./symmio-contracts/abi/v0.8.5/symmio";

/**
 * Config
 * ------
 * `createConfig()` is the entry point. The returned `Config` resolves viem
 * clients (via injected resolvers) and the per-chain address/solver registry,
 * and is passed to every action and query factory.
 */
export {
  createConfig,
  type Config,
  type ConfigParameter,
  type CreateConfigParameters,
  type GetClientFn,
  type GetWalletClientFn,
  type SymmioChainConfigInput,
  type SymmioWalletClient,
} from "./core/config";
export type { WebSocketConstructor, WebSocketLike } from "./shared/types/websocket";

/**
 * AccountLayer slice
 * ------------------
 * Read/write actions for the AccountLayer contract plus their query/mutation
 * options factories.
 */
export {
  AffiliateState,
  SubAccountIsolationType,
  addMargin,
  addMarginMutationOptions,
  cancelRegistration,
  cancelRegistrationMutationOptions,
  createSubAccounts,
  createSubAccountsMutationOptions,
  deleteSubAccount,
  deleteSubAccountMutationOptions,
  depositAndAllocateForAccount,
  depositAndAllocateForAccountMutationOptions,
  depositForAccount,
  depositForAccountMutationOptions,
  editAccountName,
  editAccountNameMutationOptions,
  generateAccountManagerAddress,
  generateAccountManagerAddressQueryKey,
  generateAccountManagerAddressQueryOptions,
  getAccountBalanceInfo,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceInfoQueryOptions,
  getAccountBalanceOf,
  getAccountBalanceOfQueryKey,
  getAccountBalanceOfQueryOptions,
  getAffiliateState,
  getAffiliateStateQueryKey,
  getAffiliateStateQueryOptions,
  getPredictedNextVirtualAccount,
  getPredictedNextVirtualAccountQueryKey,
  getPredictedNextVirtualAccountQueryOptions,
  getSubAccount,
  getSubAccountQueryKey,
  getSubAccountQueryOptions,
  getSubAccountVirtualNonce,
  getSubAccountVirtualNonceQueryKey,
  getSubAccountVirtualNonceQueryOptions,
  getSubAccountsCountOfUser,
  getSubAccountsCountOfUserQueryKey,
  getSubAccountsCountOfUserQueryOptions,
  getUserSubAccounts,
  getUserSubAccountsAddresses,
  getUserSubAccountsAddressesQueryKey,
  getUserSubAccountsAddressesQueryOptions,
  getUserSubAccountsQueryKey,
  getUserSubAccountsQueryOptions,
  getVirtualAccount,
  getVirtualAccountQueryKey,
  getVirtualAccountQueryOptions,
  getVirtualAccountsAddressesOfSubAccount,
  getVirtualAccountsAddressesOfSubAccountQueryKey,
  getVirtualAccountsAddressesOfSubAccountQueryOptions,
  removeMargin,
  removeMarginMutationOptions,
  requestToRegisterAffiliate,
  requestToRegisterAffiliateMutationOptions,
  simulateAddMargin,
  simulateAddMarginMutationOptions,
  simulateCancelRegistration,
  simulateCancelRegistrationMutationOptions,
  simulateCreateSubAccounts,
  simulateCreateSubAccountsMutationOptions,
  simulateDeleteSubAccount,
  simulateDeleteSubAccountMutationOptions,
  simulateDepositAndAllocateForAccount,
  simulateDepositAndAllocateForAccountMutationOptions,
  simulateDepositForAccount,
  simulateDepositForAccountMutationOptions,
  simulateEditAccountName,
  simulateEditAccountNameMutationOptions,
  simulateRemoveMargin,
  simulateRemoveMarginMutationOptions,
  simulateRequestToRegisterAffiliate,
  simulateRequestToRegisterAffiliateMutationOptions,
  type AccountBalanceInfo,
  type AddMarginParameters,
  type AddMarginReturnType,
  type AffiliateRegistration,
  type CancelRegistrationParameters,
  type CancelRegistrationReturnType,
  type CreateSubAccountsParameters,
  type CreateSubAccountsReturnType,
  type DeleteSubAccountParameters,
  type DeleteSubAccountReturnType,
  type DepositAndAllocateForAccountParameters,
  type DepositAndAllocateForAccountReturnType,
  type DepositForAccountParameters,
  type DepositForAccountReturnType,
  type EditAccountNameParameters,
  type EditAccountNameReturnType,
  type GenerateAccountManagerAddressData,
  type GenerateAccountManagerAddressOptions,
  type GenerateAccountManagerAddressParameters,
  type GenerateAccountManagerAddressQueryKey,
  type GenerateAccountManagerAddressQueryOptions,
  type GenerateAccountManagerAddressReturnType,
  type GetAccountBalanceInfoData,
  type GetAccountBalanceInfoOptions,
  type GetAccountBalanceInfoParameters,
  type GetAccountBalanceInfoQueryKey,
  type GetAccountBalanceInfoQueryOptions,
  type GetAccountBalanceInfoReturnType,
  type GetAccountBalanceOfData,
  type GetAccountBalanceOfOptions,
  type GetAccountBalanceOfParameters,
  type GetAccountBalanceOfQueryKey,
  type GetAccountBalanceOfQueryOptions,
  type GetAccountBalanceOfReturnType,
  type GetAffiliateStateData,
  type GetAffiliateStateOptions,
  type GetAffiliateStateParameters,
  type GetAffiliateStateQueryKey,
  type GetAffiliateStateQueryOptions,
  type GetAffiliateStateReturnType,
  type GetPredictedNextVirtualAccountData,
  type GetPredictedNextVirtualAccountOptions,
  type GetPredictedNextVirtualAccountParameters,
  type GetPredictedNextVirtualAccountQueryKey,
  type GetPredictedNextVirtualAccountQueryOptions,
  type GetPredictedNextVirtualAccountReturnType,
  type GetSubAccountData,
  type GetSubAccountOptions,
  type GetSubAccountParameters,
  type GetSubAccountQueryKey,
  type GetSubAccountQueryOptions,
  type GetSubAccountReturnType,
  type GetSubAccountVirtualNonceData,
  type GetSubAccountVirtualNonceOptions,
  type GetSubAccountVirtualNonceParameters,
  type GetSubAccountVirtualNonceQueryKey,
  type GetSubAccountVirtualNonceQueryOptions,
  type GetSubAccountVirtualNonceReturnType,
  type GetSubAccountsCountOfUserData,
  type GetSubAccountsCountOfUserOptions,
  type GetSubAccountsCountOfUserParameters,
  type GetSubAccountsCountOfUserQueryKey,
  type GetSubAccountsCountOfUserQueryOptions,
  type GetSubAccountsCountOfUserReturnType,
  type GetUserSubAccountsAddressesData,
  type GetUserSubAccountsAddressesOptions,
  type GetUserSubAccountsAddressesParameters,
  type GetUserSubAccountsAddressesQueryKey,
  type GetUserSubAccountsAddressesQueryOptions,
  type GetUserSubAccountsAddressesReturnType,
  type GetUserSubAccountsData,
  type GetUserSubAccountsOptions,
  type GetUserSubAccountsParameters,
  type GetUserSubAccountsQueryKey,
  type GetUserSubAccountsQueryOptions,
  type GetUserSubAccountsReturnType,
  type GetVirtualAccountData,
  type GetVirtualAccountOptions,
  type GetVirtualAccountParameters,
  type GetVirtualAccountQueryKey,
  type GetVirtualAccountQueryOptions,
  type GetVirtualAccountReturnType,
  type GetVirtualAccountsAddressesOfSubAccountData,
  type GetVirtualAccountsAddressesOfSubAccountOptions,
  type GetVirtualAccountsAddressesOfSubAccountParameters,
  type GetVirtualAccountsAddressesOfSubAccountQueryKey,
  type GetVirtualAccountsAddressesOfSubAccountQueryOptions,
  type GetVirtualAccountsAddressesOfSubAccountReturnType,
  type RemoveMarginParameters,
  type RemoveMarginReturnType,
  type RequestToRegisterAffiliateParameters,
  type RequestToRegisterAffiliateReturnType,
  type SchnorrSign,
  type SimulateAddMarginParameters,
  type SimulateAddMarginReturnType,
  type SimulateCancelRegistrationParameters,
  type SimulateCancelRegistrationReturnType,
  type SimulateCreateSubAccountsParameters,
  type SimulateCreateSubAccountsReturnType,
  type SimulateDeleteSubAccountParameters,
  type SimulateDeleteSubAccountReturnType,
  type SimulateDepositAndAllocateForAccountParameters,
  type SimulateDepositAndAllocateForAccountReturnType,
  type SimulateDepositForAccountParameters,
  type SimulateDepositForAccountReturnType,
  type SimulateEditAccountNameParameters,
  type SimulateEditAccountNameReturnType,
  type SimulateRemoveMarginParameters,
  type SimulateRemoveMarginReturnType,
  type SimulateRequestToRegisterAffiliateParameters,
  type SimulateRequestToRegisterAffiliateReturnType,
  type SingleUpnlSig,
  type Stakeholder,
  type SubAccountCreationData,
  type SubAccountDetail,
  type VirtualAccountDetail,
} from "./symmio-contracts/account-layer";

/**
 * Collateral slice
 * ----------------
 * ERC20 approval and balance reads for the chain's collateral token. Deposits
 * pull collateral from the user via the SYMMIO core, so `approveCollateral`
 * targets the core (`symmioAddress`).
 */
export {
  approveCollateral,
  approveCollateralMutationOptions,
  getCollateralAllowance,
  getCollateralAllowanceQueryKey,
  getCollateralAllowanceQueryOptions,
  getCollateralBalance,
  getCollateralBalanceQueryKey,
  getCollateralBalanceQueryOptions,
  simulateApproveCollateral,
  simulateApproveCollateralMutationOptions,
  type ApproveCollateralParameters,
  type ApproveCollateralReturnType,
  type GetCollateralAllowanceData,
  type GetCollateralAllowanceOptions,
  type GetCollateralAllowanceParameters,
  type GetCollateralAllowanceQueryKey,
  type GetCollateralAllowanceQueryOptions,
  type GetCollateralAllowanceReturnType,
  type GetCollateralBalanceData,
  type GetCollateralBalanceOptions,
  type GetCollateralBalanceParameters,
  type GetCollateralBalanceQueryKey,
  type GetCollateralBalanceQueryOptions,
  type GetCollateralBalanceReturnType,
  type SimulateApproveCollateralParameters,
  type SimulateApproveCollateralReturnType,
} from "./symmio-contracts/collateral";

/**
 * InstantLayer slice
 * ------------------
 * Delegated signer access on the Instant Layer contract. Reads expose both the
 * raw mapping expiry and the contract's active status; writes submit
 * `grantDelegation`.
 */
export {
  getDelegationExpiry,
  getDelegationExpiryQueryKey,
  getDelegationExpiryQueryOptions,
  getIsDelegationActive,
  getIsDelegationActiveQueryKey,
  getIsDelegationActiveQueryOptions,
  grantDelegation,
  grantDelegationMutationOptions,
  simulateGrantDelegation,
  simulateGrantDelegationMutationOptions,
  type GetDelegationExpiryData,
  type GetDelegationExpiryOptions,
  type GetDelegationExpiryParameters,
  type GetDelegationExpiryQueryKey,
  type GetDelegationExpiryQueryOptions,
  type GetDelegationExpiryReturnType,
  type GetIsDelegationActiveData,
  type GetIsDelegationActiveOptions,
  type GetIsDelegationActiveParameters,
  type GetIsDelegationActiveQueryKey,
  type GetIsDelegationActiveQueryOptions,
  type GetIsDelegationActiveReturnType,
  type GrantDelegationParameters,
  type GrantDelegationReturnType,
  type InstantLayerAccount,
  type SimulateGrantDelegationParameters,
  type SimulateGrantDelegationReturnType,
} from "./symmio-contracts/instant-layer";

/**
 * SYMMIO Core market reads
 * ------------------------
 * Direct on-chain contract-market reads from the SYMMIO core diamond.
 */
export {
  getOnchainContractMarkets,
  getOnchainContractMarketsQueryKey,
  getOnchainContractMarketsQueryOptions,
  type GetOnchainContractMarketsData,
  type GetOnchainContractMarketsOptions,
  type GetOnchainContractMarketsParameters,
  type GetOnchainContractMarketsQueryKey,
  type GetOnchainContractMarketsQueryOptions,
  type GetOnchainContractMarketsReturnType,
  type OnchainContractMarket,
} from "./symmio-contracts/symmio";

/**
 * SYMMIO Core quote reads
 * -----------------------
 * On-chain reads of quotes and open positions from the SYMMIO core diamond.
 * `getPartyAOpenPositions` returns full {@link Quote} structs; `getPartyAPendingQuotes`
 * returns pending quote ids to hydrate one-by-one with `getQuote`.
 */
export {
  OrderType,
  PositionType,
  QuoteStatus,
  getPartyAOpenPositions,
  getPartyAOpenPositionsQueryKey,
  getPartyAOpenPositionsQueryOptions,
  getPartyAPendingQuotes,
  getPartyAPendingQuotesQueryKey,
  getPartyAPendingQuotesQueryOptions,
  getQuote,
  getQuoteQueryKey,
  getQuoteQueryOptions,
  type GetPartyAOpenPositionsData,
  type GetPartyAOpenPositionsOptions,
  type GetPartyAOpenPositionsParameters,
  type GetPartyAOpenPositionsQueryKey,
  type GetPartyAOpenPositionsQueryOptions,
  type GetPartyAOpenPositionsReturnType,
  type GetPartyAPendingQuotesData,
  type GetPartyAPendingQuotesOptions,
  type GetPartyAPendingQuotesParameters,
  type GetPartyAPendingQuotesQueryKey,
  type GetPartyAPendingQuotesQueryOptions,
  type GetPartyAPendingQuotesReturnType,
  type GetQuoteData,
  type GetQuoteOptions,
  type GetQuoteParameters,
  type GetQuoteQueryKey,
  type GetQuoteQueryOptions,
  type GetQuoteReturnType,
  type LockedValues,
  type Quote,
} from "./symmio-contracts/symmio";

/**
 * Allocate / deallocate slice
 * ---------------------------
 * Move a subaccount's balance between its available and allocated (tradeable)
 * balances on the SYMMIO core. The write wrappers hide the AccountLayer `_call`
 * proxy so the core attributes the call to the subaccount. `deallocate` also
 * requires a fresh Muon uPnL signature ({@link getDeallocateUpnlSig}).
 */
export {
  allocate,
  allocateMutationOptions,
  deallocate,
  deallocateMutationOptions,
  simulateAllocate,
  simulateAllocateMutationOptions,
  simulateDeallocate,
  simulateDeallocateMutationOptions,
  type AllocateParameters,
  type AllocateReturnType,
  type DeallocateParameters,
  type DeallocateReturnType,
  type SimulateAllocateParameters,
  type SimulateAllocateReturnType,
  type SimulateDeallocateParameters,
  type SimulateDeallocateReturnType,
} from "./symmio-contracts/symmio";

/**
 * Withdraw slice
 * --------------
 * The request-based withdraw system on the SYMMIO core. The write wrappers hide
 * the AccountLayer `_call` proxying where the core attributes the call to the
 * subaccount (`initiateWithdraw`, `requestCancelWithdraw`);
 * `finalizeWithdrawRequest` is permissionless and calls the core directly.
 */
export {
  WithdrawStatus,
  createClassicWithdrawPart,
  finalizeWithdrawRequest,
  finalizeWithdrawRequestMutationOptions,
  getFeeForUser,
  getFeeForUserQueryKey,
  getFeeForUserQueryOptions,
  getLastWithdrawRequestId,
  getLastWithdrawRequestIdQueryKey,
  getLastWithdrawRequestIdQueryOptions,
  getPendingWithdrawRequests,
  getPendingWithdrawRequestsQueryKey,
  getPendingWithdrawRequestsQueryOptions,
  getWithdrawRequests,
  getWithdrawRequestsQueryKey,
  getWithdrawRequestsQueryOptions,
  getWithdrawableTime,
  getWithdrawableTimeQueryKey,
  getWithdrawableTimeQueryOptions,
  initiateWithdraw,
  initiateWithdrawMutationOptions,
  requestCancelWithdraw,
  requestCancelWithdrawMutationOptions,
  simulateFinalizeWithdrawRequest,
  simulateFinalizeWithdrawRequestMutationOptions,
  simulateInitiateWithdraw,
  simulateInitiateWithdrawMutationOptions,
  simulateRequestCancelWithdraw,
  simulateRequestCancelWithdrawMutationOptions,
  type FeeForUser,
  type FinalizeWithdrawRequestParameters,
  type FinalizeWithdrawRequestReturnType,
  type GetFeeForUserData,
  type GetFeeForUserOptions,
  type GetFeeForUserParameters,
  type GetFeeForUserQueryKey,
  type GetFeeForUserQueryOptions,
  type GetFeeForUserReturnType,
  type GetLastWithdrawRequestIdData,
  type GetLastWithdrawRequestIdOptions,
  type GetLastWithdrawRequestIdParameters,
  type GetLastWithdrawRequestIdQueryKey,
  type GetLastWithdrawRequestIdQueryOptions,
  type GetLastWithdrawRequestIdReturnType,
  type GetPendingWithdrawRequestsData,
  type GetPendingWithdrawRequestsOptions,
  type GetPendingWithdrawRequestsParameters,
  type GetPendingWithdrawRequestsQueryKey,
  type GetPendingWithdrawRequestsQueryOptions,
  type GetPendingWithdrawRequestsReturnType,
  type GetWithdrawRequestsData,
  type GetWithdrawRequestsOptions,
  type GetWithdrawRequestsParameters,
  type GetWithdrawRequestsQueryKey,
  type GetWithdrawRequestsQueryOptions,
  type GetWithdrawRequestsReturnType,
  type GetWithdrawableTimeData,
  type GetWithdrawableTimeOptions,
  type GetWithdrawableTimeParameters,
  type GetWithdrawableTimeQueryKey,
  type GetWithdrawableTimeQueryOptions,
  type GetWithdrawableTimeReturnType,
  type InitiateWithdrawParameters,
  type InitiateWithdrawReturnType,
  type RequestCancelWithdrawParameters,
  type RequestCancelWithdrawReturnType,
  type SimulateFinalizeWithdrawRequestParameters,
  type SimulateFinalizeWithdrawRequestReturnType,
  type SimulateInitiateWithdrawParameters,
  type SimulateInitiateWithdrawReturnType,
  type SimulateRequestCancelWithdrawParameters,
  type SimulateRequestCancelWithdrawReturnType,
  type WithdrawReceiverPart,
  type WithdrawRequest,
} from "./symmio-contracts/symmio";

/**
 * Chain config registry
 * ---------------------
 * Built-in SYMMIO deployment configs (addresses, subgraphs, solver) keyed by
 * chain id. Used internally by `createConfig`; also exposed directly.
 */
export {
  SymmioSupportedChainId,
  getChainConfig,
  isChainSupported,
  listSupportedChains,
  type SymmioChainConfig,
  type SymmioContractAddresses,
  type SymmioMuonConfig,
  type SymmioNotificationsConfig,
  type SymmioNotificationsProtocol,
  type SymmioPriceServiceConfig,
  type SymmioPriceServiceType,
  type SymmioSolverConfig,
  type SymmioSubgraphName,
  type SymmioSubgraphUrls,
  type SymmioTpSlConfig,
} from "./core/chains";

/**
 * Enigma price service
 * --------------------
 * REST reads for mark prices, symbol metadata, symbol listings, and health
 * from the chain's configured Enigma price-service endpoint.
 */
export {
  getEnigmaPriceServiceHealth,
  getEnigmaPriceServiceHealthQueryKey,
  getEnigmaPriceServiceHealthQueryOptions,
  getEnigmaPriceServiceMetadata,
  getEnigmaPriceServiceMetadataQueryKey,
  getEnigmaPriceServiceMetadataQueryOptions,
  getEnigmaPriceServicePricesByAddresses,
  getEnigmaPriceServicePricesByAddressesQueryKey,
  getEnigmaPriceServicePricesByAddressesQueryOptions,
  getEnigmaPriceServicePricesByNames,
  getEnigmaPriceServicePricesByNamesQueryKey,
  getEnigmaPriceServicePricesByNamesQueryOptions,
  getEnigmaPriceServiceSymbolsInfo,
  getEnigmaPriceServiceSymbolsInfoQueryKey,
  getEnigmaPriceServiceSymbolsInfoQueryOptions,
  type EnigmaMetadata,
  type EnigmaMetadataByAddress,
  type EnigmaPriceData,
  type EnigmaPriceServiceHealth,
  type EnigmaPricesByAddress,
  type EnigmaPricesByName,
  type EnigmaSymbolInfo,
  type GetEnigmaPriceServiceHealthData,
  type GetEnigmaPriceServiceHealthOptions,
  type GetEnigmaPriceServiceHealthParameters,
  type GetEnigmaPriceServiceHealthQueryKey,
  type GetEnigmaPriceServiceHealthQueryOptions,
  type GetEnigmaPriceServiceHealthReturnType,
  type GetEnigmaPriceServiceMetadataData,
  type GetEnigmaPriceServiceMetadataOptions,
  type GetEnigmaPriceServiceMetadataParameters,
  type GetEnigmaPriceServiceMetadataQueryKey,
  type GetEnigmaPriceServiceMetadataQueryOptions,
  type GetEnigmaPriceServiceMetadataReturnType,
  type GetEnigmaPriceServicePricesByAddressesData,
  type GetEnigmaPriceServicePricesByAddressesOptions,
  type GetEnigmaPriceServicePricesByAddressesParameters,
  type GetEnigmaPriceServicePricesByAddressesQueryKey,
  type GetEnigmaPriceServicePricesByAddressesQueryOptions,
  type GetEnigmaPriceServicePricesByAddressesReturnType,
  type GetEnigmaPriceServicePricesByNamesData,
  type GetEnigmaPriceServicePricesByNamesOptions,
  type GetEnigmaPriceServicePricesByNamesParameters,
  type GetEnigmaPriceServicePricesByNamesQueryKey,
  type GetEnigmaPriceServicePricesByNamesQueryOptions,
  type GetEnigmaPriceServicePricesByNamesReturnType,
  type GetEnigmaPriceServiceSymbolsInfoData,
  type GetEnigmaPriceServiceSymbolsInfoOptions,
  type GetEnigmaPriceServiceSymbolsInfoParameters,
  type GetEnigmaPriceServiceSymbolsInfoQueryKey,
  type GetEnigmaPriceServiceSymbolsInfoQueryOptions,
  type GetEnigmaPriceServiceSymbolsInfoReturnType,
} from "./price-service/enigma";

/**
 * Notifications stream
 * --------------------
 * `watchNotifications` subscribes to the chain's notifications WebSocket and
 * delivers normalized, classified position/quote state notifications. The
 * reconnecting-socket primitive underneath stays internal; `SocketStatus` is the
 * connection state it reports.
 */
export {
  ActionStatus,
  NotificationType,
  buildSubscribeMessage,
  classifyNotification,
  normalizeNotification,
  parseNotificationFrame,
  watchNotifications,
  type BuildSubscribeMessageParameters,
  type DefilyticsNotificationEnvelope,
  type Notification,
  type RawPositionNotification,
  type Unwatch,
  type WatchNotificationsParameters,
} from "./websocket/notifications";
export type { SocketStatus } from "./websocket/socket";

/**
 * Price-service stream
 * --------------------
 * `watchEnigmaPrices` subscribes to the chain's Enigma lowcap price WebSocket
 * and delivers parsed `EnigmaPriceTick` batches. Broadcast-only — no subscribe
 * message; watchers sharing the same `wsUrl` share one socket.
 */
export {
  parsePriceFrame,
  watchEnigmaPrices,
  type EnigmaPriceTick,
  type RawEnigmaPriceFrame,
  type WatchEnigmaPricesParameters,
} from "./websocket/prices";
/**
 * Notifications search
 * --------------------
 * `searchNotifications` queries the notification service's `POST /api/v1/search`
 * endpoint — a free-form equality filter over stored notifications. Keys are
 * matched exactly, whether top-level (`app_name`, …) or a dotted payload path
 * (`data.temp_quote_id`, …); {@link NotificationSearchFilter} types the known
 * keys while still accepting any string key. The REST counterpart to the live
 * `watchNotifications` stream.
 */
export {
  searchNotifications,
  searchNotificationsQueryKey,
  searchNotificationsQueryOptions,
  type NotificationDocument,
  type NotificationQueryValue,
  type NotificationSearchField,
  type NotificationSearchFilter,
  type NotificationSearchResult,
  type SearchNotificationsData,
  type SearchNotificationsOptions,
  type SearchNotificationsParameters,
  type SearchNotificationsQueryKey,
  type SearchNotificationsQueryOptions,
  type SearchNotificationsReturnType,
} from "./notifications";

/**
 * Markets
 * -------
 * Fetch tradable markets from the chain's solver `/contract-symbols` endpoint.
 */
export {
  getMarkets,
  getMarketsQueryKey,
  getMarketsQueryOptions,
  type GetMarketsData,
  type GetMarketsOptions,
  type GetMarketsParameters,
  type GetMarketsQueryKey,
  type GetMarketsQueryOptions,
  type GetMarketsReturnType,
  type SymbolContractSymbol,
} from "./solvers/markets";

/**
 * Funding info
 * ------------
 * Fetch per-market funding rates (next-epoch long/short), next funding time,
 * and epoch length from the chain's solver `/get_funding_info` endpoint. Rates
 * are plain per-epoch decimal fractions (×100 for a percentage); a positive
 * rate receives funding, a negative rate pays. {@link projectFundingRate}
 * extrapolates a per-epoch rate over a day window (linear, non-compounded).
 */
export {
  calculatePriceImpact,
  getEstimatedPrice,
  getEstimatedPriceQueryKey,
  getEstimatedPriceQueryOptions,
  toEstimatedPrice,
  type CalculatePriceImpactParameters,
  type EstimatedPriceEntry,
  type GetEstimatedPriceData,
  type GetEstimatedPriceOptions,
  type GetEstimatedPriceParameters,
  type GetEstimatedPriceQueryKey,
  type GetEstimatedPriceQueryOptions,
  type GetEstimatedPriceReturnType,
} from "./solvers/estimated-price";
export {
  getFundingInfo,
  getFundingInfoQueryKey,
  getFundingInfoQueryOptions,
  projectFundingRate,
  toMarketFundingInfo,
  type GetFundingInfoData,
  type GetFundingInfoOptions,
  type GetFundingInfoParameters,
  type GetFundingInfoQueryKey,
  type GetFundingInfoQueryOptions,
  type GetFundingInfoReturnType,
  type MarketFundingInfo,
  type ProjectFundingRateParameters,
} from "./solvers/funding-info";

/**
 * Market info (solver)
 * --------------------
 * Per-market 24h trading volume and lifetime value from the chain's solver,
 * plus the aggregate totals across every market. Dollar amounts are plain
 * numbers as the solver reports them; no decimal scaling.
 */
export {
  getMarketInfo,
  getMarketInfoQueryKey,
  getMarketInfoQueryOptions,
  toMarketInfo,
  type GetMarketInfoData,
  type GetMarketInfoOptions,
  type GetMarketInfoParameters,
  type GetMarketInfoQueryKey,
  type GetMarketInfoQueryOptions,
  type GetMarketInfoReturnType,
  type MarketVolume,
} from "./solvers/market-info";

/**
 * Locked params
 * -------------
 * Fetch solver lock percentages for a market/leverage pair.
 */
export {
  getLockedParams,
  getLockedParamsQueryKey,
  getLockedParamsQueryOptions,
  type GetLockedParamsData,
  type GetLockedParamsOptions,
  type GetLockedParamsParameters,
  type GetLockedParamsQueryKey,
  type GetLockedParamsQueryOptions,
  type GetLockedParamsReturnType,
  type SolverLockedParams,
} from "./solvers/locked-params";

/**
 * Notional cap (available liquidity)
 * ----------------------------------
 * Fetch the solver's per-market notional cap and remaining available liquidity
 * (`availableToLong`, `availableToShort`, …). Dollar amounts are surfaced as
 * plain numbers with no scaling. {@link checkNotionalCap} gates a candidate
 * open trade against the chosen side's available liquidity.
 */
export {
  checkNotionalCap,
  getNotionalCapAll,
  getNotionalCapAllQueryKey,
  getNotionalCapAllQueryOptions,
  getNotionalCapBySymbolId,
  getNotionalCapBySymbolIdQueryKey,
  getNotionalCapBySymbolIdQueryOptions,
  getOpenInterestBySymbolId,
  getOpenInterestBySymbolIdQueryKey,
  getOpenInterestBySymbolIdQueryOptions,
  toMarketNotionalCap,
  type CheckNotionalCapInputs,
  type CheckNotionalCapResult,
  type GetNotionalCapAllData,
  type GetNotionalCapAllOptions,
  type GetNotionalCapAllParameters,
  type GetNotionalCapAllQueryKey,
  type GetNotionalCapAllQueryOptions,
  type GetNotionalCapAllReturnType,
  type GetNotionalCapBySymbolIdData,
  type GetNotionalCapBySymbolIdOptions,
  type GetNotionalCapBySymbolIdParameters,
  type GetNotionalCapBySymbolIdQueryKey,
  type GetNotionalCapBySymbolIdQueryOptions,
  type GetNotionalCapBySymbolIdReturnType,
  type GetOpenInterestBySymbolIdData,
  type GetOpenInterestBySymbolIdOptions,
  type GetOpenInterestBySymbolIdParameters,
  type GetOpenInterestBySymbolIdQueryKey,
  type GetOpenInterestBySymbolIdQueryOptions,
  type GetOpenInterestBySymbolIdReturnType,
  type MarketNotionalCap,
} from "./solvers/notional-cap";

/**
 * Solver error codes
 * ------------------
 * Fetch the solver's `/error_codes` map to resolve the numeric `errorCode`
 * reported on a failed open/close notification to a human-readable message.
 */
export {
  getSolverErrorCodes,
  getSolverErrorCodesQueryKey,
  getSolverErrorCodesQueryOptions,
  type GetSolverErrorCodesData,
  type GetSolverErrorCodesOptions,
  type GetSolverErrorCodesParameters,
  type GetSolverErrorCodesQueryKey,
  type GetSolverErrorCodesQueryOptions,
  type GetSolverErrorCodesReturnType,
} from "./solvers/error-codes";

/**
 * Muon oracle service
 * -------------------
 * Fetch the Muon `uPnl_A` attestation `removeMargin` requires, assembled into a
 * contract-ready `SingleUpnlSig`. The gateway is a query-param REST endpoint
 * with no OpenAPI spec, so its request/response types are hand-written.
 */
export {
  MUON_APP,
  MUON_METHOD_PARTY_A_OVERVIEW,
  MUON_METHOD_PRICE,
  MUON_METHOD_PRICE_RANGE,
  MUON_METHOD_SETTLE_UPNL,
  MUON_METHOD_UPNL_A,
  MUON_METHOD_UPNL_A_WITH_SYMBOL_PRICE,
  MUON_METHOD_UPNL_B,
  MUON_METHOD_UPNL_PAIR,
  MUON_METHOD_UPNL_WITH_SYMBOL_PRICE,
  // uPnl_A assembled into the contract-ready SingleUpnlSig (for removeMargin)
  getDeallocateUpnlSig,
  getDeallocateUpnlSigQueryKey,
  getDeallocateUpnlSigQueryOptions,
  getMuonPartyAOverview,
  getMuonPartyAOverviewQueryKey,
  getMuonPartyAOverviewQueryOptions,
  getMuonPrice,
  getMuonPriceQueryKey,
  getMuonPriceQueryOptions,
  getMuonPriceRange,
  getMuonPriceRangeQueryKey,
  getMuonPriceRangeQueryOptions,
  getMuonSettleUpnl,
  getMuonSettleUpnlQueryKey,
  getMuonSettleUpnlQueryOptions,
  getMuonUpnl,
  // Muon services — raw normalized attestations (one per documented method)
  getMuonUpnlA,
  getMuonUpnlAQueryKey,
  getMuonUpnlAQueryOptions,
  getMuonUpnlAWithSymbolPrice,
  getMuonUpnlAWithSymbolPriceQueryKey,
  getMuonUpnlAWithSymbolPriceQueryOptions,
  getMuonUpnlB,
  getMuonUpnlBQueryKey,
  getMuonUpnlBQueryOptions,
  getMuonUpnlQueryKey,
  getMuonUpnlQueryOptions,
  getMuonUpnlWithSymbolPrice,
  getMuonUpnlWithSymbolPriceQueryKey,
  getMuonUpnlWithSymbolPriceQueryOptions,
  type GetDeallocateUpnlSigData,
  type GetDeallocateUpnlSigOptions,
  type GetDeallocateUpnlSigParameters,
  type GetDeallocateUpnlSigQueryKey,
  type GetDeallocateUpnlSigQueryOptions,
  type GetDeallocateUpnlSigReturnType,
  type GetMuonPartyAOverviewData,
  type GetMuonPartyAOverviewOptions,
  type GetMuonPartyAOverviewParameters,
  type GetMuonPartyAOverviewQueryKey,
  type GetMuonPartyAOverviewQueryOptions,
  type GetMuonPartyAOverviewReturnType,
  type GetMuonPriceData,
  type GetMuonPriceOptions,
  type GetMuonPriceParameters,
  type GetMuonPriceQueryKey,
  type GetMuonPriceQueryOptions,
  type GetMuonPriceRangeData,
  type GetMuonPriceRangeOptions,
  type GetMuonPriceRangeParameters,
  type GetMuonPriceRangeQueryKey,
  type GetMuonPriceRangeQueryOptions,
  type GetMuonPriceRangeReturnType,
  type GetMuonPriceReturnType,
  type GetMuonSettleUpnlData,
  type GetMuonSettleUpnlOptions,
  type GetMuonSettleUpnlParameters,
  type GetMuonSettleUpnlQueryKey,
  type GetMuonSettleUpnlQueryOptions,
  type GetMuonSettleUpnlReturnType,
  type GetMuonUpnlAData,
  type GetMuonUpnlAOptions,
  type GetMuonUpnlAParameters,
  type GetMuonUpnlAQueryKey,
  type GetMuonUpnlAQueryOptions,
  type GetMuonUpnlAReturnType,
  type GetMuonUpnlAWithSymbolPriceData,
  type GetMuonUpnlAWithSymbolPriceOptions,
  type GetMuonUpnlAWithSymbolPriceParameters,
  type GetMuonUpnlAWithSymbolPriceQueryKey,
  type GetMuonUpnlAWithSymbolPriceQueryOptions,
  type GetMuonUpnlAWithSymbolPriceReturnType,
  type GetMuonUpnlBData,
  type GetMuonUpnlBOptions,
  type GetMuonUpnlBParameters,
  type GetMuonUpnlBQueryKey,
  type GetMuonUpnlBQueryOptions,
  type GetMuonUpnlBReturnType,
  type GetMuonUpnlData,
  type GetMuonUpnlOptions,
  type GetMuonUpnlParameters,
  type GetMuonUpnlQueryKey,
  type GetMuonUpnlQueryOptions,
  type GetMuonUpnlReturnType,
  type GetMuonUpnlWithSymbolPriceData,
  type GetMuonUpnlWithSymbolPriceOptions,
  type GetMuonUpnlWithSymbolPriceParameters,
  type GetMuonUpnlWithSymbolPriceQueryKey,
  type GetMuonUpnlWithSymbolPriceQueryOptions,
  type GetMuonUpnlWithSymbolPriceReturnType,
  type MuonAttestationBase,
  type MuonRawResult,
  type MuonResponse,
} from "./muon";

/**
 * Shared types & query helpers
 * ----------------------------
 * Parameter-helper types (mirroring wagmi's conventions) and the query-key
 * filter used by the options factories.
 */
export type {
  ChainIdParameter,
  Compute,
  ConfigKeyParameter,
  DeepPartial,
  ExactPartial,
  FromParameter,
  SimulateBeforeWriteParameter,
  WriteContractParameter,
  WriteSolverParameter,
} from "./shared/types/properties";
export type { QueryParameter, SymmioQueryOptions } from "./shared/types/query";
export { sharePercent } from "./shared/utils/percent";
export { decimalPriceToWei } from "./shared/utils/price";
export { filterQueryOptions } from "./shared/utils/query";
export { shouldSimulateBeforeWrite } from "./shared/utils/simulate-before-write";

/**
 * Errors
 * ------
 * `SymmError` is the base class for SDK-level failures (unknown chain, missing
 * wallet resolver, validation). On-chain failures surface as viem's native
 * errors and are not wrapped.
 */
export { SymmApiError, SymmError, type SymmErrorKind } from "./shared/errors/symm-error";

/**
 * InstantLayer v2 (lowcap) — Instant Open
 * ---------------------------------------
 * Lowcap instant-open flow: trade math, calldata encoders, EIP-712 signed
 * operations, hedger HTTP wrapper, and three action layers — pure primitive
 * (`instantOpen`), wizard (`prepareInstantOpenParams`), and auto convenience
 * (`instantOpenAuto`).
 */
export {
  // selectors
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  // eip712
  INSTANT_LAYER_EIP712_DOMAIN_NAME,
  INSTANT_LAYER_EIP712_DOMAIN_VERSION,
  INSTANT_TRADE_REQUIRED_SELECTORS,
  // trade math
  MARKET_ORDER_DEADLINE_SECONDS,
  // types / constants
  ORDER_TYPE_MARKET,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
  SIGNED_OPERATION_TYPES,
  VIRTUAL_ACCOUNT_ISOLATION_TYPE,
  // calldata
  ZERO_UPNL_SIG,
  buildQuoteMetadata,
  // operations
  buildSignedOperation,
  // trade math — spendable margin for the Max chip (fee + slippage shave)
  calculateAvailableInstantOpenMargin,
  calculateMargin,
  calculateTradeParams,
  computePlatformFee,
  encodeAddMarginToNextVA,
  encodeSendQuoteWithAffiliateAndData,
  formatSignedOperationPayload,
  generateSalt,
  getFakeSendQuoteMuonSignature,
  getInstantLayerEip712Domain,
  // instant-open reads (off-chain hedger)
  getInstantOpenQuoteId,
  getInstantOpenQuoteIdQueryKey,
  getInstantOpenQuoteIdQueryOptions,
  getInstantOpens,
  getInstantOpensQueryKey,
  getInstantOpensQueryOptions,
  getMarketOrderDeadline,
  // instantOpen — primitive (all inputs required, no fetching)
  instantOpen,
  instantOpenAuto,
  instantOpenAutoMutationOptions,
  instantOpenMutationOptions,
  isolationTypeForSide,
  // instantOpen — wizard (auto-fetches missing inputs)
  prepareInstantOpenParams,
  // resolvers (sub-units used by the wizard)
  resolveFeeRates,
  resolveLockedParams,
  resolveMarkPrice,
  resolveMarket,
  // hedger api
  sendInstantOpen,
  signAndFormatInstantOperation,
  signSignedOperation,
  toWeiBigInt,
  // quote constraints — pre-submit validation against market caps/floors
  validateInstantOpenAgainstMarket,
  type BuildSignedOperationParameters,
  type CalculateAvailableInstantOpenMarginParameters,
  type CalculateMarginParameters,
  type CalculateTradeParamsParameters,
  type CalculateTradeParamsReturnType,
  type ComputePlatformFeeRates,
  type EncodeAddMarginToNextVAParameters,
  type EncodeSendQuoteWithAffiliateAndDataParameters,
  type FlexField,
  // instant-open read types
  type GetInstantOpenQuoteIdData,
  type GetInstantOpenQuoteIdOptions,
  type GetInstantOpenQuoteIdParameters,
  type GetInstantOpenQuoteIdQueryKey,
  type GetInstantOpenQuoteIdQueryOptions,
  type GetInstantOpenQuoteIdReturnType,
  type GetInstantOpensData,
  type GetInstantOpensOptions,
  type GetInstantOpensParameters,
  type GetInstantOpensQueryKey,
  type GetInstantOpensQueryOptions,
  type GetInstantOpensReturnType,
  type InstantOpenLockedParams,
  type InstantOpenMargin,
  type InstantOpenMarketData,
  type InstantOpenOrder,
  type InstantOpenParameters,
  type InstantOpenReturnType,
  type InstantOperationPayload,
  type PendingInstantOpen,
  type PrepareInstantOpenParameters,
  type QuoteConstraintViolation,
  type ReplayAttackHeader,
  type ResolveFeeRatesParameters,
  type ResolveLockedParamsParameters,
  type ResolveMarkPriceParameters,
  type ResolveMarketParameters,
  type ResolvedLockedParams,
  type ResolvedMarket,
  type SendInstantOpenParameters,
  type SendInstantOpenReturnType,
  type SignAndFormatInstantOperationParameters,
  type SignedOperation,
  type SignedOperationPayload,
  type UpnlSig,
  type ValidateInstantOpenAgainstMarketParameters,
  type ValidateInstantOpenAgainstMarketReturnType,
  type VirtualAccountIsolationType,
} from "./solvers/instant-open";

/**
 * InstantLayer v2 (lowcap) — Instant Close
 * ----------------------------------------
 * Lowcap instant-close flow: close-price math, calldata encoder for
 * `requestToClosePosition`, hedger HTTP wrapper, the close-side quote
 * constraint validator, and three action layers — pure primitive
 * (`instantClose`), wizard (`prepareInstantCloseParams`), and auto
 * convenience (`instantCloseAuto`).
 *
 * Lowcap only — Majors flows are out of scope. Reuses `buildSignedOperation`,
 * `signAndFormatInstantOperation`, the EIP-712 domain, `PositionType`, and
 * `ORDER_TYPE_MARKET` from the open slice (single source of truth — both
 * slices encode the same on-chain enums and share the InstantLayer signing
 * protocol). This block only adds close-specific symbols.
 */
export {
  MAX_INSTANT_CLOSE_BULK_ORDERS,
  calculateClosePrice,
  clampClosePrecision,
  encodeRequestToClosePosition,
  // instant-close reads (off-chain hedger)
  getInstantCloses,
  getInstantClosesQueryKey,
  getInstantClosesQueryOptions,
  instantClose,
  instantCloseAuto,
  instantCloseAutoMutationOptions,
  instantCloseBulk,
  instantCloseBulkAuto,
  instantCloseBulkAutoMutationOptions,
  instantCloseBulkMutationOptions,
  instantCloseMutationOptions,
  prepareInstantCloseParams,
  sendInstantClose,
  toPendingInstantClose,
  validateInstantCloseAgainstMarket,
  type CalculateClosePriceParameters,
  type ClampClosePrecisionParameters,
  type CloseQuoteConstraintViolation,
  type EncodeRequestToClosePositionParameters,
  // instant-close read types
  type GetInstantClosesData,
  type GetInstantClosesOptions,
  type GetInstantClosesParameters,
  type GetInstantClosesQueryKey,
  type GetInstantClosesQueryOptions,
  type GetInstantClosesReturnType,
  type InstantCloseBulkAutoOrder,
  type InstantCloseBulkAutoParameters,
  type InstantCloseBulkOrder,
  type InstantCloseBulkParameters,
  type InstantCloseBulkReturnType,
  type InstantCloseMarketData,
  type InstantCloseOrder,
  type InstantCloseParameters,
  type InstantCloseReturnType,
  type PendingInstantClose,
  type PrepareInstantCloseParameters,
  type SendInstantCloseParameters,
  type SendInstantCloseReturnType,
  type ValidateInstantCloseAgainstMarketParameters,
  type ValidateInstantCloseAgainstMarketReturnType,
} from "./solvers/instant-close";

/**
 * Unified quotes
 * --------------
 * Pure reconciliation of every quote source — on-chain positions & pending
 * quotes, pending instant-opens & instant-closes, and notifications — into one
 * stable, de-duplicated, lifecycle-tagged {@link UnifiedQuote} list. The merge is
 * deterministic given an injected `now` and the previous result (the framework
 * layer drives the clock and polling cadence). `shouldAccelerateQuotePolling`
 * tells the consumer when to poll faster. The `aggregate*` folds roll a
 * {@link QuoteGroup}'s children into one figure — `aggregateGroupFunding`
 * reports settled-to-date funding with `netReceived = received − paid`, so a
 * **positive** value means the group **earned** funding, sharing the plain-trader
 * polarity of `aggregateGroupUpnl`, where a **positive** `upnl` means in profit.
 */
export {
  QuoteLifecycle,
  aggregateGroupFunding,
  aggregateGroupMetrics,
  aggregateGroupUpnl,
  applyNotificationToQuotes,
  calculateClosePlatformFee,
  calculateLiquidationPrice,
  calculateOpenPlatformFee,
  calculateQuoteLeverage,
  calculateQuotePnl,
  calculateQuoteUpnl,
  classifyQuoteNotificationAction,
  fingerprintQuote,
  getSubAccountQuotes,
  getSubAccountQuotesQueryKey,
  getSubAccountQuotesQueryOptions,
  groupQuotes,
  isActivePosition,
  isPendingOrder,
  lifecycleFromQuoteStatus,
  minRemainingQuantityOf,
  partitionQuotes,
  planGroupClose,
  reconcileQuotes,
  resolveQuoteAccounts,
  resolveQuoteGroupingStrategy,
  shouldAccelerateOnchainReads,
  shouldAccelerateQuotePolling,
  toGroupCloseCandidates,
  toUnifiedQuoteFromInstantClose,
  toUnifiedQuoteFromInstantOpen,
  toUnifiedQuoteFromOnchain,
  type AccountPosition,
  type CalculateClosePlatformFeeInputs,
  type CalculateLiquidationPriceInputs,
  type CalculateOpenPlatformFeeInputs,
  type CalculateQuoteLeverageParameters,
  type CalculateQuotePnlInputs,
  type CalculateQuotePnlReturnType,
  type CalculateQuoteUpnlInputs,
  type CalculateQuoteUpnlReturnType,
  type GetSubAccountQuotesData,
  type GetSubAccountQuotesOptions,
  type GetSubAccountQuotesParameters,
  type GetSubAccountQuotesQueryKey,
  type GetSubAccountQuotesQueryOptions,
  type GetSubAccountQuotesReturnType,
  type GroupCloseAllocation,
  type GroupCloseCandidate,
  type GroupQuotesOptions,
  type PartitionedQuotes,
  type PlanGroupCloseFailure,
  type PlanGroupCloseFailureReason,
  type PlanGroupCloseResult,
  type PlanGroupCloseSuccess,
  type QuoteGroup,
  type QuoteGroupBy,
  type QuoteGroupFunding,
  type QuoteGroupKey,
  type QuoteGroupKeyFn,
  type QuoteGroupMetrics,
  type QuoteGroupUpnl,
  type QuoteGroupingStrategy,
  type QuoteNotificationActionKind,
  type QuoteOrigin,
  type ReconcileQuotesInput,
  type ReconcileQuotesResult,
  type ResolveQuoteAccountsParameters,
  type ResolveQuoteAccountsResult,
  type ToUnifiedQuoteFromInstantCloseContext,
  type UnifiedQuote,
} from "./quotes";

/**
 * Margin & risk
 * -------------
 * `calculateMarginRisk` folds an account's `balanceInfoOfPartyA` fields and its
 * unrealized PnL into the figures a margin panel shows: total / maintenance /
 * initial margin, equity, the cushion left before liquidation, and how much of
 * that cushion is intact. `isLiquidatable` is bit-for-bit the protocol's own
 * solvency predicate, so a UI never has to approximate it.
 *
 * Every figure describes **one liquidation domain** — each Virtual Account is
 * liquidated independently, so never pass sums across accounts. The **price** at
 * which liquidation happens is `calculateLiquidationPrice` (exported with the
 * quotes above).
 */
export { calculateMarginRisk, type CalculateMarginRiskInputs, type MarginRiskMetrics } from "./margin";

/**
 * Subgraph layer (GraphQL)
 * ------------------------
 * Low-level escape hatch for running typed GraphQL documents against a chain's
 * configured subgraph (default `analytics`) over the SDK's axios transport.
 * Curated subgraph reads (e.g. `getQuoteHistory`) are built on this.
 */
export {
  getQuerySubgraphQueryKey,
  querySubgraph,
  querySubgraphQueryOptions,
  type QuerySubgraphOptions,
  type QuerySubgraphParameters,
  type QuerySubgraphQueryKey,
  type QuerySubgraphQueryOptions,
  type QuerySubgraphReturnType,
  type SubgraphDocument,
} from "./symmio-subgraph";

/**
 * Quote history (subgraph)
 * ------------------------
 * `getQuoteHistory` reads a subaccount's closed/liquidated quotes from the
 * analytics subgraph's immutable `quoteEvents`, overlaying each event's frozen
 * metadata snapshot so multiple partial-close rows stay individually accurate.
 */
export {
  QuoteCloseEventType,
  QuoteCloseType,
  closeTypeToEventTypes,
  eventTypeToCloseType,
  eventTypeToQuoteStatus,
  getQuoteHistory,
  getQuoteHistoryQueryKey,
  getQuoteHistoryQueryOptions,
  toQuoteHistoryRow,
  type GetQuoteHistoryData,
  type GetQuoteHistoryOptions,
  type GetQuoteHistoryParameters,
  type GetQuoteHistoryQueryKey,
  type GetQuoteHistoryQueryOptions,
  type GetQuoteHistoryReturnType,
  type QuoteHistoryRow,
  type RawQuoteEventRow,
} from "./quotes";

/**
 * Quote events by type (subgraph)
 * -------------------------------
 * `getQuoteEventsByType` reads non-terminal `QuoteEvent`s (open-price recompute,
 * funding charges) from the analytics subgraph, filtered to the requested event
 * types. Decoded `metadata` fields are placed on a typed row alongside the
 * raw payload.
 */
export {
  DEFAULT_QUOTE_EVENTS_BY_TYPE_PAGE_SIZE,
  FUNDING_HISTORY_EVENT_TYPES,
  PRICE_HISTORY_EVENT_TYPES,
  QuoteEventType,
  getQuoteEventsByType,
  getQuoteEventsByTypeQueryKey,
  getQuoteEventsByTypeQueryOptions,
  toQuoteEventRow,
  type GetQuoteEventsByTypeData,
  type GetQuoteEventsByTypeOptions,
  type GetQuoteEventsByTypeParameters,
  type GetQuoteEventsByTypeQueryKey,
  type GetQuoteEventsByTypeQueryOptions,
  type GetQuoteEventsByTypeReturnType,
  type QuoteEventRow,
  type RawQuoteEventNode,
} from "./quotes";

/**
 * Quote events by type, batched (subgraph)
 * ----------------------------------------
 * `getQuotesEventsByType` is the many-quote sibling of `getQuoteEventsByType`:
 * one round-trip covers every quote in a position group, and the subgraph
 * returns the rows already interleaved and sorted by `timestamp`, with `first` /
 * `skip` paging the merged stream rather than each id. Pair it with
 * {@link FUNDING_HISTORY_EVENT_TYPES} for a group-wide funding timeline — those
 * are the charges **settled to date** (what the analytics subgraph indexed);
 * funding accrued since the last on-chain charge is not indexed and is absent.
 * Netting a row is `net = fundingPaid - fundingReceived`, so a **positive** net
 * means the user net-**paid**.
 */
export {
  getQuotesEventsByType,
  getQuotesEventsByTypeQueryKey,
  getQuotesEventsByTypeQueryOptions,
  type GetQuotesEventsByTypeData,
  type GetQuotesEventsByTypeOptions,
  type GetQuotesEventsByTypeParameters,
  type GetQuotesEventsByTypeQueryKey,
  type GetQuotesEventsByTypeQueryOptions,
  type GetQuotesEventsByTypeReturnType,
} from "./quotes";

/**
 * Quote funding (subgraph)
 * ------------------------
 * `getQuoteFunding` reads `userPaidFunding` / `userReceivedFunding` for a batch
 * of on-chain quote ids from the analytics subgraph, chunked at
 * {@link QUOTES_FUNDING_MAX_IDS_PER_REQUEST} ids per request. Filters by the
 * protocol `quoteId` scalar so callers never need the diamond address. The rows
 * are funding **settled to date**; `netReceived = received − paid`, so a
 * **positive** value means the position **earned** funding.
 */
export {
  QUOTES_FUNDING_MAX_IDS_PER_REQUEST,
  getQuoteFunding,
  getQuoteFundingQueryKey,
  getQuoteFundingQueryOptions,
  toQuoteFundingRow,
  type GetQuoteFundingData,
  type GetQuoteFundingOptions,
  type GetQuoteFundingParameters,
  type GetQuoteFundingQueryKey,
  type GetQuoteFundingQueryOptions,
  type GetQuoteFundingReturnType,
  type QuoteFundingData,
  type RawQuoteFundingRow,
} from "./quotes";

/**
 * TP/SL (conditional orders)
 * --------------------------
 * Phase 1 — on-chain enigma quotes only. Reads the handler's `/configs/` rules,
 * `/signing-spec`, current TP/SL per quote, and writes new TP/SL orders signed
 * with the session key against the handler's EIP-712 typed-data domain.
 */
export {
  DEFAULT_TPSL_SLIPPAGE_LOWCAPS,
  TPSL_LIVE_ORDER_STATES,
  ZERO_LEG,
  buildConditionalOrderLeg,
  buildConditionalOrderMessage,
  buildTpSlDeleteMessage,
  deleteQuoteTpSl,
  deleteQuoteTpSlMutationOptions,
  generateTpSlSalt,
  getQuoteTpSl,
  getQuoteTpSlQueryKey,
  getQuoteTpSlQueryOptions,
  getTpSlConfig,
  getTpSlConfigQueryKey,
  getTpSlConfigQueryOptions,
  getTpSlDeleteSigningSpec,
  getTpSlDeleteSigningSpecQueryKey,
  getTpSlDeleteSigningSpecQueryOptions,
  getTpSlSigningSpec,
  getTpSlSigningSpecQueryKey,
  getTpSlSigningSpecQueryOptions,
  priceSlippageCalculation,
  searchTpSlOrders,
  searchTpSlOrdersQueryKey,
  searchTpSlOrdersQueryOptions,
  setQuoteTpSl,
  setQuoteTpSlMutationOptions,
  signTpSlRequest,
  toSignableTpSlMessage,
  validateTpSl,
  type DeleteQuoteTpSlParameters,
  type DeleteQuoteTpSlReturnType,
  type GetQuoteTpSlData,
  type GetQuoteTpSlOptions,
  type GetQuoteTpSlParameters,
  type GetQuoteTpSlQueryKey,
  type GetQuoteTpSlQueryOptions,
  type GetQuoteTpSlReturnType,
  type GetTpSlConfigData,
  type GetTpSlConfigOptions,
  type GetTpSlConfigParameters,
  type GetTpSlConfigQueryKey,
  type GetTpSlConfigQueryOptions,
  type GetTpSlConfigReturnType,
  type GetTpSlDeleteSigningSpecData,
  type GetTpSlDeleteSigningSpecOptions,
  type GetTpSlDeleteSigningSpecParameters,
  type GetTpSlDeleteSigningSpecQueryKey,
  type GetTpSlDeleteSigningSpecQueryOptions,
  type GetTpSlDeleteSigningSpecReturnType,
  type GetTpSlSigningSpecData,
  type GetTpSlSigningSpecOptions,
  type GetTpSlSigningSpecParameters,
  type GetTpSlSigningSpecQueryKey,
  type GetTpSlSigningSpecQueryOptions,
  type GetTpSlSigningSpecReturnType,
  type QuoteTpSl,
  type QuoteTpSlActionPriceType,
  type QuoteTpSlConditionalOrderType,
  type QuoteTpSlRow,
  type QuoteTpSlRowState,
  type SearchTpSlOrdersData,
  type SearchTpSlOrdersOptions,
  type SearchTpSlOrdersParameters,
  type SearchTpSlOrdersQueryKey,
  type SearchTpSlOrdersQueryOptions,
  type SearchTpSlOrdersReturnType,
  type SetQuoteTpSlParameters,
  type SetQuoteTpSlReturnType,
  type SetTpSlSide,
  type TpSlConditionalOrderLeg,
  type TpSlConditionalOrderMessage,
  type TpSlConditionalOrderType,
  type TpSlConfig,
  type TpSlDeleteMessage,
  type TpSlInfoState,
  type TpSlPriceType,
  type TpSlSignedRequest,
  type TpSlSigningSpec,
  type TpSlValidation,
  type ValidateTpSlInputs,
} from "./tpsl";

/**
 * Grouped TP/SL
 * -------------
 * Pure helpers that fold the per-quote conditional orders of a grouped position
 * (`QuoteGroup`) into one state, and plan the writes needed to change it. The
 * handler has no bulk endpoint — one signed request per quote — so
 * `planGroupTpSl` diffs the desired state against what the handler already
 * holds and emits only the children that genuinely need a `set` or a `delete`.
 */
export {
  GROUP_TPSL_SIDES,
  childNotional,
  estimateGroupTpSlReturn,
  planGroupTpSl,
  planGroupTpSlDelete,
  resolveChildSide,
  summarizeQuoteGroupTpSl,
  toGroupTpSlChildren,
  toGroupTpSlOrders,
  triggerPriceToWei,
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
  type GroupTpSlSnapshotLookup,
  type PlanGroupTpSlDeleteResult,
  type PlanGroupTpSlParameters,
  type PlanGroupTpSlResult,
  type QuoteGroupTpSlSummary,
  type ResolvedChildSide,
  type SummarizeQuoteGroupTpSlOptions,
  type ToGroupTpSlOrdersOptions,
} from "./tpsl";

/**
 * TP/SL WebSocket
 * ---------------
 * Live notifications stream for conditional-order state transitions.
 */
export {
  parseTpSlFrame,
  watchTpSlNotifications,
  type RawTpSlNotification,
  type RawTpSlNotificationData,
  type RawTpSlNotificationDetails,
  type RawTpSlNotificationState,
  type TpSlNotification,
  type UnwatchTpSl,
  type WatchTpSlNotificationsParameters,
} from "./websocket/tpsl";

/**
 * Balance history (subgraph)
 * --------------------------
 * `getBalanceHistory` reads a sub-account's deposit / withdraw history from the
 * analytics subgraph's `balanceChanges` collection, filtered by movement type
 * (deposit / withdraw / bridge), time range, and pagination. Amounts are raw
 * `bigint` in collateral decimals.
 */
export {
  BalanceChangeType,
  BalanceHistoryFilter,
  MarginTransferType,
  balanceHistoryFilterToTypes,
  getBalanceHistory,
  getBalanceHistoryQueryKey,
  getBalanceHistoryQueryOptions,
  toBalanceHistoryRow,
  type BalanceHistoryRow,
  type GetBalanceHistoryData,
  type GetBalanceHistoryOptions,
  type GetBalanceHistoryParameters,
  type GetBalanceHistoryQueryKey,
  type GetBalanceHistoryQueryOptions,
  type GetBalanceHistoryReturnType,
  type InternalTransfersMode,
  type RawBalanceChangeRow,
} from "./balance-history";

/**
 * Transfer history (events subgraph)
 * ----------------------------------
 * `getTransferHistory` reads internal transfers (margin moves between SYMMIO
 * accounts) from the **events** subgraph's `internalTransfers` collection — the
 * source behind a "Transfer" view. Rows carry raw `from` / `to` endpoints, an
 * 18-decimal `amount`, and a `direction` relative to the queried accounts.
 */
export {
  getTransferHistory,
  getTransferHistoryQueryKey,
  getTransferHistoryQueryOptions,
  toTransferRow,
  type GetTransferHistoryData,
  type GetTransferHistoryOptions,
  type GetTransferHistoryParameters,
  type GetTransferHistoryQueryKey,
  type GetTransferHistoryQueryOptions,
  type GetTransferHistoryReturnType,
  type RawInternalTransferRow,
  type TransferDirection,
  type TransferRow,
  type TransferRowDirection,
} from "./transfers";

/**
 * Candles slice
 * -------------
 * Chart data, decoupled from any chart library. A `CandleSource` supplies the
 * three things every charting library needs — symbol metadata, bars for a range,
 * and a live subscription — so adapters and hooks are written against that
 * interface rather than against a venue.
 *
 * `createBinanceCandleSource` is the reference source for major markets;
 * `toTradingViewDatafeed` adapts any source to TradingView's Charting Library
 * without the SDK depending on that licensed package. `priceBasis` on every
 * source states what its prices actually represent — a reference exchange is
 * not the solver mark a SYMMIO trade settles at.
 */
export {
  BINANCE_EXCHANGE_INFO_PATH,
  BINANCE_KLINES_PATH,
  BINANCE_MAX_LIMIT,
  BINANCE_REST_URL,
  BINANCE_WS_URL,
  CANDLE_RESOLUTION_MS,
  createBinanceCandleSource,
  fromTradingViewResolution,
  getBinanceSupportedResolutions,
  getCandlesQueryKey,
  getCandlesQueryOptions,
  parseBinanceKline,
  parseBinanceKlineEvent,
  resolutionToMs,
  toBinanceInterval,
  toTradingViewDatafeed,
  toTradingViewResolution,
  watchBinanceKlines,
  type BinanceCandleSourceParameters,
  type BinanceMarket,
  type Candle,
  type CandlePriceBasis,
  type CandleResolution,
  type CandleSource,
  type CandleSymbol,
  type CandleUpdateMeta,
  type GetCandlesData,
  type GetCandlesOptions,
  type GetCandlesParameters,
  type GetCandlesQueryKey,
  type GetCandlesQueryOptions,
  type GetCandlesReturnType,
  type ToTradingViewDatafeedOptions,
  type TradingViewBar,
  type TradingViewDatafeed,
  type TradingViewDatafeedConfiguration,
  type TradingViewHistoryMetadata,
  type TradingViewPeriodParams,
  type TradingViewSymbolInfo,
  type WatchBinanceKlinesParameters,
  type WatchCandlesParameters,
} from "./candles";
