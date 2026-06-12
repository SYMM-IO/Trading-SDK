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

/**
 * AccountLayer slice
 * ------------------
 * Read/write actions for the AccountLayer contract plus their query/mutation
 * options factories.
 */
export {
  SubAccountIsolationType,
  createSubAccounts,
  createSubAccountsMutationOptions,
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
  getVirtualAccountsAddressesOfSubAccount,
  getVirtualAccountsAddressesOfSubAccountQueryKey,
  getVirtualAccountsAddressesOfSubAccountQueryOptions,
  simulateCreateSubAccounts,
  simulateCreateSubAccountsMutationOptions,
  simulateDepositAndAllocateForAccount,
  simulateDepositAndAllocateForAccountMutationOptions,
  simulateDepositForAccount,
  simulateDepositForAccountMutationOptions,
  simulateEditAccountName,
  simulateEditAccountNameMutationOptions,
  type AccountBalanceInfo,
  type CreateSubAccountsParameters,
  type CreateSubAccountsReturnType,
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
  type GetVirtualAccountsAddressesOfSubAccountData,
  type GetVirtualAccountsAddressesOfSubAccountOptions,
  type GetVirtualAccountsAddressesOfSubAccountParameters,
  type GetVirtualAccountsAddressesOfSubAccountQueryKey,
  type GetVirtualAccountsAddressesOfSubAccountQueryOptions,
  type GetVirtualAccountsAddressesOfSubAccountReturnType,
  type SimulateCreateSubAccountsParameters,
  type SimulateCreateSubAccountsReturnType,
  type SimulateDepositAndAllocateForAccountParameters,
  type SimulateDepositAndAllocateForAccountReturnType,
  type SimulateDepositForAccountParameters,
  type SimulateDepositForAccountReturnType,
  type SimulateEditAccountNameParameters,
  type SimulateEditAccountNameReturnType,
  type SubAccountCreationData,
  type SubAccountDetail,
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
 * Allocate slice
 * --------------
 * Move a subaccount's available balance into its allocated (tradeable) balance
 * on the SYMMIO core. The write wrapper hides the AccountLayer `_call` proxy so
 * the core attributes the call to the subaccount.
 */
export {
  allocate,
  allocateMutationOptions,
  simulateAllocate,
  simulateAllocateMutationOptions,
  type AllocateParameters,
  type AllocateReturnType,
  type SimulateAllocateParameters,
  type SimulateAllocateReturnType,
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
