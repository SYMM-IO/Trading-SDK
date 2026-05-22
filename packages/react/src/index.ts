/**
 * `@symm-frontier/react` — React adapter for the SYMMIO SDK.
 *
 * The public surface is intentionally flat: one hook per concept, all
 * normalized to the same error type (`SymmioRequestError`) and the same
 * configuration source (`SymmioProvider`). Sub-entries
 * (`@symm-frontier/react/provider`, `/account-layer`, `/wallet`, `/errors`,
 * `/amounts`, `/transactions`) are exposed for tree-shakable deep imports.
 *
 * @remarks
 * Every re-export below is **explicit** rather than `export *`, so adding a
 * symbol to a slice's barrel does not automatically publish it from the
 * package root. Same pattern `@symm-frontier/core` uses — see that file for
 * the longer rationale.
 */

/**
 * Provider
 * --------
 * The single context every other hook consumes. Mount inside a
 * `WagmiProvider` and `QueryClientProvider` (the host's, shared with wagmi).
 */
export { SymmioProvider, useSymmioConfig, type SymmioProviderProps } from "./provider";

/**
 * Config
 * ------
 * Types and enums describing the resolved SDK config exposed by the provider.
 */
export {
  SymmioSupportedChainId,
  resolveSymmioConfig,
  type SymmioClientConfig,
  type SymmioClientConfigInput,
  type SymmioContractAddresses,
  type SymmioEnvironment,
  type SymmioResolvedChainConfig,
  type SymmioSolverConfig,
  type SymmioSubgraphUrls,
} from "./config";

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
  type EditAccountNameResult,
  type UseEditAccountNameOptions,
  type UseUserSubAccountsParams,
} from "./account-layer";

/**
 * Core re-exports
 * ---------------
 * Types and enums the SDK consumes from `@symm-frontier/core`. Re-exported so
 * apps that already depend on `@symm-frontier/react` don't have to add a
 * second dependency on `core` just to import a type. `apps/web` cannot depend
 * on `core` directly (Hard Rule 6) and must come through here.
 */
export {
  SubAccountIsolationType,
  SymmError,
  type EditAccountNameParams,
  type GetUserSubAccountsParams,
  type SubAccountDetail,
} from "@symm-frontier/core";

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
 * Amounts
 * -------
 * Re-export of the `@symm-frontier/utils/amounts` helpers — convenience so apps
 * don't have to add `@symm-frontier/utils` to their `package.json` just to
 * format a balance.
 */
export {
  decimalToRaw,
  formatTokenAmount,
  parseTokenAmount,
  rawToDecimal,
  type FormatTokenAmountOptions,
} from "./amounts";

/**
 * Address helpers
 * ---------------
 * Re-export of the `@symm-frontier/utils/address` helpers.
 */
export { shortenAddress, type ShortenAddressOptions } from "./address";

/**
 * Transactions
 * ------------
 * Optional zustand store for tracking in-flight tx hashes in the UI.
 */
export { useTransactionsStore, type TrackedTx, type TransactionsStoreState } from "./transactions";
