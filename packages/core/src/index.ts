/**
 * `@symm-frontier/core` — framework-agnostic SYMMIO SDK.
 *
 * a single immutable {@link Config} (created with
 * {@link createConfig}) is the first argument of every standalone action
 * (`getMarkets(config, params)`), and each read/write ships a matching TanStack
 * Query / Mutation options factory (`getMarketsQueryOptions(config, options)`).
 * `core` depends on viem for contracts, axios for REST APIs, and
 * `@tanstack/query-core` for query option types — no framework. Framework
 * layers (`@symm-frontier/react`, a future Vue layer) inject the viem-client
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
  SubAccountIsolationType,
  addMargin,
  addMarginMutationOptions,
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
  getAccountBalanceInfo,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceInfoQueryOptions,
  getAccountBalanceOf,
  getAccountBalanceOfQueryKey,
  getAccountBalanceOfQueryOptions,
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
  simulateAddMargin,
  simulateAddMarginMutationOptions,
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
  type AccountBalanceInfo,
  type AddMarginParameters,
  type AddMarginReturnType,
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
  type SchnorrSign,
  type SimulateAddMarginParameters,
  type SimulateAddMarginReturnType,
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
  type SingleUpnlSig,
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
  type SymmioSubgraphUrls,
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
 *
 * Lowcap only — Majors flows are out of scope.
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
 * tells the consumer when to poll faster.
 */
export {
  QuoteLifecycle,
  aggregateGroupMetrics,
  applyNotificationToQuotes,
  fingerprintQuote,
  getSubAccountQuotes,
  getSubAccountQuotesQueryKey,
  getSubAccountQuotesQueryOptions,
  groupQuotes,
  isActivePosition,
  isPendingOrder,
  lifecycleFromQuoteStatus,
  partitionQuotes,
  reconcileQuotes,
  resolveQuoteAccounts,
  resolveQuoteGroupingStrategy,
  shouldAccelerateQuotePolling,
  toUnifiedQuoteFromInstantClose,
  toUnifiedQuoteFromInstantOpen,
  toUnifiedQuoteFromOnchain,
  type GetSubAccountQuotesData,
  type GetSubAccountQuotesOptions,
  type GetSubAccountQuotesParameters,
  type GetSubAccountQuotesQueryKey,
  type GetSubAccountQuotesQueryOptions,
  type GetSubAccountQuotesReturnType,
  type GroupQuotesOptions,
  type PartitionedQuotes,
  type QuoteGroup,
  type QuoteGroupBy,
  type QuoteGroupKey,
  type QuoteGroupKeyFn,
  type QuoteGroupMetrics,
  type QuoteGroupingStrategy,
  type QuoteOrigin,
  type ReconcileQuotesInput,
  type ReconcileQuotesResult,
  type ResolveQuoteAccountsParameters,
  type ResolveQuoteAccountsResult,
  type ToUnifiedQuoteFromInstantCloseContext,
  type UnifiedQuote,
} from "./quotes";
