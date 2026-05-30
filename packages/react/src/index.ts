/**
 * `@symm-frontier/react` — React adapter for the SYMMIO SDK.
 *
 * The public surface is intentionally flat: one hook per concept, all
 * normalized to the same error type (`SymmioRequestError`) and the same
 * configuration source (`SymmioProvider`). Sub-entries
 * (`@symm-frontier/react/provider`, `/account-layer`, `/wallet`, `/errors`,
 * `/transactions`) are exposed for tree-shakable deep imports.
 *
 * @remarks
 * Every re-export below is **explicit** rather than `export *`, so adding a
 * symbol to a slice's barrel does not automatically publish it from the
 * package root. Same pattern `@symm-frontier/core` uses — see that file for
 * the longer rationale.
 */

/**
 * Provider & Client
 * -----------------
 * The single context every other hook consumes. Mount inside a
 * `WagmiProvider` and `QueryClientProvider` (the host's, shared with wagmi).
 * Access config via `useSymmioClient()?.config`.
 */
export { SymmioProvider, useSymmioClient, type SymmioProviderProps } from "./provider";

/**
 * Config
 * ------
 * React-specific config types. Chain configs (addresses, subgraphs, solver)
 * live in `@symm-frontier/core` — import `SymmioSupportedChainId`, `getChainConfig`,
 * and related types from there.
 */
export { type SymmioClientConfigInput } from "./config";

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
  accountLayerQueryKeys,
  useEditAccountName,
  useUserSubAccounts,
  type EditAccountNameMutationParams,
  type EditAccountNameResult,
  type GetUserSubAccountsKeyArgs,
  type UseEditAccountNameOptions,
  type UseUserSubAccountsParams,
} from "./account-layer";

/**
 * Query
 * -----
 * Helpers for building tagged React-Query keys and turning them into
 * `invalidateQueries` predicates without hand-writing key arrays.
 */
export { defineQueryKey, predicateMatch, type TaggedQueryKey } from "./utils";

/**
 * Errors
 * ------
 * Normalized error type every SDK hook surfaces, plus the classifier the
 * hooks use internally. UIs branch on `error.kind`.
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
 * Optional zustand store for tracking in-flight tx hashes in the UI.
 */
export { useTransactionsStore, type TrackedTx, type TransactionsStoreState } from "./transactions";
