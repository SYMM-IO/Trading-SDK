/**
 * `@symm-frontier/core` — framework-agnostic SYMMIO SDK.
 *
 * The public surface is intentionally flat: free functions per slice, plus
 * viem `.extend()` action factories for ergonomic per-client method attachment.
 * Sub-entries (`@symm-frontier/core/abi`, `/account-layer`, `/chains`) are
 * also exposed for tree-shakable deep imports.
 */

/**
 * Re-export convention used throughout this file.
 *
 * @remarks
 * Every re-export below uses **explicit named exports**, not `export *`, even
 * when the underlying barrel lists exactly the same symbols. The cost of a
 * curated public surface is small and the upside is real:
 *
 * - **Deliberate boundary** — adding a symbol to a slice's `index.ts` does not
 *   automatically publish it from the package root. New public APIs require
 *   editing this file, which forces a conscious "yes, this is public" decision.
 * - **No accidental leaks** — a helper added to a slice barrel so a sibling
 *   slice can import it won't silently surface to consumers.
 * - **Tooling clarity** — API extractors, typedoc, and IDE "go to definition"
 *   resolve named re-exports more predictably than transitive `export *` chains.
 * - **Readability** — this file is the single, scannable list of the SDK's
 *   public API; no need to follow barrels to see what consumers get.
 *
 * When adding a new export, list each symbol explicitly (values first, then
 * `type` re-exports), matching the style of the blocks below.
 *
 * @internal
 */

/**
 * ABI fragments
 * -------------
 * Raw viem-style `Abi` arrays for SYMMIO contracts. Exposed for consumers who
 * want to call viem directly (e.g. `readContract({ abi: accountLayerAbi })`)
 */
export { accountLayerAbi } from "./abi/v0.8.5/account-layer";

/**
 * AccountLayer slice
 * ------------------
 * Read and write surface for the AccountLayer contract. Also exposes the
 * `.extend()` action factories (`accountLayerReadActions`, `accountLayerWriteActions`)
 */
export {
  SubAccountIsolationType,
  accountLayerReadActions,
  accountLayerWriteActions,
  editAccountName,
  getUserSubAccounts,
  type AccountLayerReadActions,
  type AccountLayerWriteActions,
  type EditAccountNameParams,
  type GetUserSubAccountsParams,
  type SubAccountDetail,
} from "./account-layer";

/**
 * Chain config registry
 * ---------------------
 * Built-in SYMMIO deployment configs (addresses, subgraphs, solver) keyed by
 * chain ID and environment. Use `getChainConfig()` to resolve a complete config,
 * or access individual addresses directly from the result.
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
} from "./chains";

/**
 * Markets
 * -------
 * Fetch tradable markets from solver's `/contract-symbols` endpoint.
 */
export { MarketState, getMarkets, type Market } from "./markets";

/**
 * Client factory
 * --------------
 * `createSymmioClient()` is the main entry point for most consumers. It returns
 * a client with bound read/write actions — no need to pass config or addresses
 * per call.
 */
export {
  createSymmioClient,
  type CreateSymmioClientParams,
  type EditAccountNameClientParams,
  type GetUserSubAccountsClientParams,
  type SymmioClient,
} from "./client";

/**
 * Errors
 * ------
 * `SymmError` is the base class for SDK-level failures (unknown chain, missing
 * config, validation, etc.). On-chain failures are **not** wrapped — they
 * surface as viem's native errors (`ContractFunctionExecutionError`,
 * `CallExecutionError`, ...) so consumers can handle them with viem's own
 * error hierarchy.
 */
export { SymmError } from "./errors";
