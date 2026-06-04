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
  useCreateSubAccounts,
  useEditAccountName,
  useSubAccount,
  useSubAccountVirtualNonce,
  useSubAccountsCountOfUser,
  useUserSubAccounts,
  useUserSubAccountsAddresses,
  type CreateSubAccountsResult,
  type EditAccountNameResult,
  type UseCreateSubAccountsParameters,
  type UseCreateSubAccountsReturnType,
  type UseEditAccountNameParameters,
  type UseEditAccountNameReturnType,
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
} from "./account-layer";

/**
 * Markets hooks
 * -------------
 * Fetch tradable markets (contract symbols) from the solver.
 */
export { useMarkets, type UseMarketsParameters, type UseMarketsReturnType } from "./markets";

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
