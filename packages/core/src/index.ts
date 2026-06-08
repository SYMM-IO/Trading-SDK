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
  getSimulateCreateSubAccountsQueryKey,
  getSimulateCreateSubAccountsQueryOptions,
  getSimulateDepositAndAllocateForAccountQueryKey,
  getSimulateDepositAndAllocateForAccountQueryOptions,
  getSimulateDepositForAccountQueryKey,
  getSimulateDepositForAccountQueryOptions,
  getSimulateEditAccountNameQueryKey,
  getSimulateEditAccountNameQueryOptions,
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
  simulateCreateSubAccounts,
  simulateDepositAndAllocateForAccount,
  simulateDepositForAccount,
  simulateEditAccountName,
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
  type SimulateCreateSubAccountsData,
  type SimulateCreateSubAccountsOptions,
  type SimulateCreateSubAccountsParameters,
  type SimulateCreateSubAccountsQueryKey,
  type SimulateCreateSubAccountsQueryOptions,
  type SimulateCreateSubAccountsReturnType,
  type SimulateDepositAndAllocateForAccountData,
  type SimulateDepositAndAllocateForAccountOptions,
  type SimulateDepositAndAllocateForAccountParameters,
  type SimulateDepositAndAllocateForAccountQueryKey,
  type SimulateDepositAndAllocateForAccountQueryOptions,
  type SimulateDepositAndAllocateForAccountReturnType,
  type SimulateDepositForAccountData,
  type SimulateDepositForAccountOptions,
  type SimulateDepositForAccountParameters,
  type SimulateDepositForAccountQueryKey,
  type SimulateDepositForAccountQueryOptions,
  type SimulateDepositForAccountReturnType,
  type SimulateEditAccountNameData,
  type SimulateEditAccountNameOptions,
  type SimulateEditAccountNameParameters,
  type SimulateEditAccountNameQueryKey,
  type SimulateEditAccountNameQueryOptions,
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
  getSimulateApproveCollateralQueryKey,
  getSimulateApproveCollateralQueryOptions,
  simulateApproveCollateral,
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
  type SimulateApproveCollateralData,
  type SimulateApproveCollateralOptions,
  type SimulateApproveCollateralParameters,
  type SimulateApproveCollateralQueryKey,
  type SimulateApproveCollateralQueryOptions,
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
  getSimulateGrantDelegationQueryKey,
  getSimulateGrantDelegationQueryOptions,
  grantDelegation,
  grantDelegationMutationOptions,
  simulateGrantDelegation,
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
  type SimulateGrantDelegationData,
  type SimulateGrantDelegationOptions,
  type SimulateGrantDelegationParameters,
  type SimulateGrantDelegationQueryKey,
  type SimulateGrantDelegationQueryOptions,
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
  getSimulateFinalizeWithdrawRequestQueryKey,
  getSimulateFinalizeWithdrawRequestQueryOptions,
  getSimulateInitiateWithdrawQueryKey,
  getSimulateInitiateWithdrawQueryOptions,
  getSimulateRequestCancelWithdrawQueryKey,
  getSimulateRequestCancelWithdrawQueryOptions,
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
  simulateInitiateWithdraw,
  simulateRequestCancelWithdraw,
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
  type SimulateFinalizeWithdrawRequestData,
  type SimulateFinalizeWithdrawRequestOptions,
  type SimulateFinalizeWithdrawRequestParameters,
  type SimulateFinalizeWithdrawRequestQueryKey,
  type SimulateFinalizeWithdrawRequestQueryOptions,
  type SimulateFinalizeWithdrawRequestReturnType,
  type SimulateInitiateWithdrawData,
  type SimulateInitiateWithdrawOptions,
  type SimulateInitiateWithdrawParameters,
  type SimulateInitiateWithdrawQueryKey,
  type SimulateInitiateWithdrawQueryOptions,
  type SimulateInitiateWithdrawReturnType,
  type SimulateRequestCancelWithdrawData,
  type SimulateRequestCancelWithdrawOptions,
  type SimulateRequestCancelWithdrawParameters,
  type SimulateRequestCancelWithdrawQueryKey,
  type SimulateRequestCancelWithdrawQueryOptions,
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
  getEnigmaPriceServicePrices,
  getEnigmaPriceServicePricesQueryKey,
  getEnigmaPriceServicePricesQueryOptions,
  getEnigmaPriceServiceSymbolsInfo,
  getEnigmaPriceServiceSymbolsInfoQueryKey,
  getEnigmaPriceServiceSymbolsInfoQueryOptions,
  type EnigmaMetadata,
  type EnigmaMetadataByAddress,
  type EnigmaPriceData,
  type EnigmaPriceServiceHealth,
  type EnigmaPricesByAddress,
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
  type GetEnigmaPriceServicePricesData,
  type GetEnigmaPriceServicePricesOptions,
  type GetEnigmaPriceServicePricesParameters,
  type GetEnigmaPriceServicePricesQueryKey,
  type GetEnigmaPriceServicePricesQueryOptions,
  type GetEnigmaPriceServicePricesReturnType,
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
} from "./shared/types/properties";
export type { QueryParameter, SymmioQueryOptions } from "./shared/types/query";
export { filterQueryOptions } from "./shared/utils/query";

/**
 * Errors
 * ------
 * `SymmError` is the base class for SDK-level failures (unknown chain, missing
 * wallet resolver, validation). On-chain failures surface as viem's native
 * errors and are not wrapped.
 */
export { SymmApiError, SymmError, type SymmErrorKind } from "./shared/errors/symm-error";
