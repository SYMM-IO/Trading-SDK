/**
 * `@symm-frontier/core` — framework-agnostic SYMMIO SDK.
 *
 * The shape follows wagmi: a single immutable {@link Config} (created with
 * {@link createConfig}) is the first argument of every standalone action
 * (`getMarkets(config, params)`), and each read/write ships a matching TanStack
 * Query / Mutation options factory (`getMarketsQueryOptions(config, options)`).
 * `core` depends only on viem and `@tanstack/query-core` — no framework, no
 * wagmi. Framework layers (`@symm-frontier/react`, a future Vue layer) inject
 * the viem-client resolvers the config needs.
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
  editAccountName,
  editAccountNameMutationOptions,
  getUserSubAccounts,
  getUserSubAccountsQueryKey,
  getUserSubAccountsQueryOptions,
  type EditAccountNameParameters,
  type EditAccountNameReturnType,
  type GetUserSubAccountsData,
  type GetUserSubAccountsOptions,
  type GetUserSubAccountsParameters,
  type GetUserSubAccountsQueryKey,
  type GetUserSubAccountsQueryOptions,
  type GetUserSubAccountsReturnType,
  type SubAccountDetail,
} from "./symmio-contracts/account-layer";

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
  type SymmioSolverConfig,
  type SymmioSubgraphUrls,
} from "./core/chains";

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
 * Shared types & query helpers
 * ----------------------------
 * Parameter-helper types (mirroring wagmi's conventions) and the query-key
 * filter used by the options factories.
 */
export type {
  ChainIdParameter,
  Compute,
  DeepPartial,
  ExactPartial,
  ScopeKeyParameter,
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
