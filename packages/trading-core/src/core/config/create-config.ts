import { type Address, type PublicClient } from "viem";
import { SymmError } from "../../shared/errors/symm-error";
import type { DeepPartial } from "../../shared/types/properties";
import type { WebSocketConstructor } from "../../shared/types/websocket";
import {
  assertSupportedSolver,
  resolveSolver,
  type SolverId,
  type SymmioChainConfig,
  type SymmioContractAddresses,
  type SymmioSolverConfig,
  type SymmioSupportedChainId,
} from "../chains";
import { hashChainConfig, hashSolverConfig } from "./config-key";
import { buildChainConfigs } from "./merge-chain-config";
import type { SymmioWalletClient } from "./types";

/**
 * Per-chain SYMMIO configuration input for {@link createConfig}, deep-merged onto
 * that chain's built-in defaults.
 *
 * Every field is optional to override **except** `addresses.affiliatesAddress` —
 * your frontend's on-chain affiliate for that chain (your identity in SYMMIO),
 * attached to every quote so the protocol attributes the trade to you and routes
 * your fee share. It is mandatory in the type because affiliate addresses are per
 * chain (a registration on one chain is not valid on another) and a missing one
 * would silently fall back to the built-in default affiliate, losing attribution.
 */
export type SymmioChainConfigInput = Omit<DeepPartial<SymmioChainConfig>, "addresses"> & {
  addresses: DeepPartial<SymmioContractAddresses> & Pick<SymmioContractAddresses, "affiliatesAddress">;
};

export type { SymmioWalletClient } from "./types";

/** Resolve a viem `PublicClient` for reads, optionally for a specific chain. */
export type GetClientFn = (parameters?: { chainId?: number }) => PublicClient;

/**
 * Returns the wallet client the SDK should sign/write with.
 *
 * The SDK does not pick between multiple wallets. The consumer's resolver
 * receives the optional `from` (passed by the action) and is responsible for
 * returning the right wallet client — e.g. session-key when `from` matches the
 * session key, wagmi-connected wallet otherwise. The resolver is called fresh
 * per action so account switches in the connected wallet propagate without
 * recreating the config.
 */
export type GetWalletClientFn = (parameters: { chainId: number; from?: Address }) => Promise<SymmioWalletClient>;

/**
 * Parameters for {@link createConfig}.
 */
export interface CreateConfigParameters {
  /**
   * Per-chain SYMMIO configuration, keyed by chain id — deep-merged onto the
   * SDK's built-in defaults. Each entry may override that chain's `addresses`,
   * `subgraphs`, `solvers`, `priceService`, `notifications`, and `muon` endpoints.
   *
   * **Required.** Every supported chain must supply an
   * `addresses.affiliatesAddress` — your frontend's on-chain **affiliate**
   * (your identity in SYMMIO on that chain), attached to every quote
   * (`sendQuoteWithAffiliateAndData`) so the protocol knows who sourced the trade
   * and routes your share of the trading fee to you. Affiliate addresses are per
   * chain: a registration on one chain is not valid on another. `createConfig`
   * throws `AFFILIATE_ADDRESS_REQUIRED` only when it is **missing**, so a trade
   * can never silently fall back to the built-in default affiliate and lose
   * attribution. The **zero address is accepted** as a no-affiliate test
   * placeholder — trades still open, you just earn no fee share; a **non-zero
   * unregistered** affiliate is what reverts on-chain (`PartyAFacet: Invalid
   * affiliate`). Register at https://trading-sdk.symm.io/affiliate to earn fees.
   *
   * The zero address is accepted here (the SDK only checks presence) — treat it
   * as a **testing placeholder**. On-chain it is a **no-affiliate sentinel**: the
   * trade still opens, you just receive **no share of the trading fee** (nothing
   * is attributed to you). What reverts on-chain is a **non-zero _unregistered_**
   * affiliate — that fails with `PartyAFacet: Invalid affiliate` at trade time. Use
   * a **registered** affiliate to earn your fee share.
   *
   * @example
   * ```ts
   * symmioConfig: {
   *   [SymmioSupportedChainId.HYPER_EVM]: {
   *     addresses: { affiliatesAddress: "0xYourHyperEvmAffiliate…" },
   *     // optional: subgraphs, solvers, priceService, notifications, muon
   *   },
   * }
   * ```
   */
  symmioConfig: Partial<Record<number, SymmioChainConfigInput>>;
  /**
   * Returns the viem `PublicClient` used for read actions. Framework layers
   * inject this — e.g. `@symmio/trading-react` bridges it to wagmi's
   * `getPublicClient`. In a plain Node script, return your own viem client.
   */
  getClient: GetClientFn;
  /**
   * Returns the bound viem `WalletClient` to sign/write with. Receives the
   * optional `from` from the action — when the consumer has multiple potential
   * signers (e.g. session-key + connected wallet), this resolver picks. The
   * SDK does no address matching itself; passing `from` is just a hint.
   *
   * Optional — read-only configs may omit it; write/sign actions then throw.
   */
  getWalletClient?: GetWalletClientFn;
  /**
   * Chain used when an action or query omits `chainId`. Defaults to the first
   * built-in supported chain.
   */
  defaultChainId?: number;
  /**
   * Dry-run every write with `simulateContract` before sending it, aborting (and
   * throwing the decoded revert) if the transaction would fail. Defaults to
   * `true`. Override for a single call with the write's `simulateBeforeWrite`
   * option; set `false` here to disable the pre-flight for all writes.
   */
  simulateBeforeWrite?: boolean;
  /**
   * WebSocket implementation used by streaming actions (e.g. `watchNotifications`).
   * Defaults to `globalThis.WebSocket` — set in browsers and Node 22+. Pass an
   * implementation explicitly to run streams in environments without a global
   * (e.g. the `ws` package in older Node, or a mock in tests).
   */
  webSocketConstructor?: WebSocketConstructor;
}

/**
 * The immutable SDK config every action and query factory receives as its first
 * argument. Holds the per-chain registry and the viem-client resolvers.
 */
export interface Config {
  /** Chain ids the config knows about (built-in defaults plus overrides). */
  readonly chains: readonly number[];
  /** Chain used when an action or query omits `chainId`. */
  readonly defaultChainId: number;
  /**
   * Default for the pre-send dry-run on writes. When `true` (the default), a
   * write runs `simulateContract` and aborts if it would revert, unless the call
   * passes `simulateBeforeWrite: false`.
   */
  readonly simulateBeforeWrite: boolean;
  /**
   * Resolve the fully-merged config for a chain.
   * @throws {SymmError} when the chain is not supported.
   */
  getChainConfig(chainId?: number): SymmioChainConfig;
  /**
   * Stable fingerprint of a chain's fully-resolved config (addresses, solvers,
   * subgraphs). Identical for identical config across reloads and SSR; changes
   * iff that chain's resolved config changes.
   *
   * The query option factories fold this into every query key, so a runtime
   * override produces a fresh key — TanStack refetches with the new config
   * instead of serving stale cache. Returns a stable sentinel for chains the
   * config does not know about (it never throws, so it is safe to call while
   * building query options for an unsupported chain).
   */
  getChainConfigKey(chainId?: number): string;
  /**
   * Resolve a chain's solver config. When `solverId` is given, returns that
   * solver; otherwise returns the chain's `defaultSolverId` solver.
   *
   * @param parameters - Optional `chainId` (defaults to `defaultChainId`) and
   *   `solverId` (defaults to the chain's `defaultSolverId`).
   * @throws {SymmError} `UNSUPPORTED_CHAIN` when the chain is unknown, or
   *   `UNKNOWN_SOLVER` when the chain has no solver with that id.
   */
  getSolver(parameters?: { chainId?: number; solverId?: SolverId }): SymmioSolverConfig;
  /**
   * Stable fingerprint of ONE resolved solver on a chain (folds `chainId`,
   * `solverId`, `kind`, `version`, and the solver's endpoints). Solver-facing
   * query factories fold this into their keys — **instead of**
   * {@link getChainConfigKey} — so two solvers on the same chain never share a
   * cache entry, and overriding one solver's config rotates only that solver's
   * keys. Resolves `solverId` to the chain's `defaultSolverId` when omitted;
   * returns a stable sentinel (never throws) for an unknown chain or solver, so
   * it is safe to call while building query options.
   */
  getSolverKey(parameters?: { chainId?: number; solverId?: SolverId }): string;
  /**
   * Id of the chain's default solver (its `defaultSolverId`) — the solver an
   * action targets when it omits `solverId`.
   */
  getDefaultSolverId(chainId?: number): SolverId;
  /**
   * Ids of every solver configured on a chain. Resolve each with
   * {@link getSolver} — e.g. to build a solver picker.
   *
   * @throws {SymmError} `UNSUPPORTED_CHAIN` when the chain is unknown.
   */
  listSolverIds(chainId?: number): readonly SolverId[];
  /** Resolve the viem `PublicClient` for reads on a chain. */
  getClient(parameters?: { chainId?: number }): PublicClient;
  /**
   * Resolve the wallet client for writes / off-chain signs.
   *
   * Forwards `chainId` (defaulting to `defaultChainId`) and the optional
   * `from` to the consumer's `getWalletClient` resolver. The resolver decides
   * which wallet to return; the SDK does not perform address matching.
   *
   * @throws {SymmError} when the config was created without `getWalletClient`.
   */
  getWalletClient(parameters?: { chainId?: number; from?: Address }): Promise<SymmioWalletClient>;
  /**
   * Resolve the WebSocket implementation streaming actions open connections
   * with. Returns the injected `webSocketConstructor`, falling back to
   * `globalThis.WebSocket`.
   *
   * @throws {SymmError} when neither an injected constructor nor a global
   *   `WebSocket` is available.
   */
  getWebSocketConstructor(): WebSocketConstructor;
}

/**
 * Optional `config` override mixin for hook/action parameters. When omitted, the
 * config is read from context (in the react layer) or must be passed explicitly.
 */
export interface ConfigParameter {
  /** Use this config instead of the one from context. */
  config?: Config;
}

/**
 * Create an SDK {@link Config}.
 *
 * @example
 * ```ts
 * import { createConfig } from "@symmio/trading-core";
 * import { createPublicClient, createWalletClient, http } from "viem";
 * import { hyperEvm } from "viem/chains";
 *
 * const publicClient = createPublicClient({ chain: hyperEvm, transport: http() });
 * const walletClient = createWalletClient({ account, chain: hyperEvm, transport: http() });
 *
 * const config = createConfig({
 *   symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: "0xYourHyperEvmAffiliate…" } } },
 *   getClient: () => publicClient,
 *   getWalletClient: async () => walletClient,
 * });
 * ```
 */
export function createConfig(parameters: CreateConfigParameters): Config {
  const {
    getClient,
    getWalletClient,
    symmioConfig,
    defaultChainId,
    simulateBeforeWrite = true,
    webSocketConstructor,
  } = parameters;

  const chainConfigs = buildChainConfigs(symmioConfig);

  // Affiliate is required only for a chain the consumer EXPLICITLY configured (has a
  // `symmioConfig[chainId]` entry) that can ALSO trade — one with at least one solver.
  // Configuring a chain is the opt-in that obliges you to name your affiliate for it;
  // the affiliate rides every quote (`sendQuoteWithAffiliateAndData`). A built-in chain
  // the consumer never mentions is left alone: it may be an onboarding/placeholder chain
  // not really tradable yet, and it falls back to its registry affiliate — so we do not
  // force every consumer to supply an affiliate for a chain they never touch. The zero
  // address is accepted (a no-affiliate placeholder — trades open, no fee share); only a
  // MISSING affiliate throws. A non-zero UNREGISTERED affiliate is not caught here; it
  // reverts on-chain at trade time (`PartyAFacet: Invalid affiliate`). Check the raw
  // input (not the merged config, whose default would mask a gap).
  for (const key of Object.keys(symmioConfig ?? {})) {
    const chainId = Number(key) as SymmioSupportedChainId;
    const hasSolvers = Object.keys(chainConfigs[chainId]?.solvers ?? {}).length > 0;
    if (!hasSolvers) continue;
    const affiliate = symmioConfig?.[chainId]?.addresses?.affiliatesAddress;
    if (!affiliate)
      throw new SymmError(
        "config",
        "AFFILIATE_ADDRESS_REQUIRED",
        `createConfig: \`symmioConfig[${chainId}].addresses.affiliatesAddress\` is required. No affiliate yet? Pass the zero address — trades still open, you just earn no fee share. Affiliate addresses are per chain; register at https://trading-sdk.symm.io/affiliate to earn your fee share.`,
      );
  }

  const chainIds = Object.keys(chainConfigs).map(Number);
  if (chainIds.length === 0)
    throw new SymmError("config", "NO_CHAINS_CONFIGURED", "createConfig: no supported chains are configured.");
  const resolvedDefaultChainId = defaultChainId ?? chainIds[0]!;

  /** Per-chain config fingerprints, precomputed once from the resolved registry. */
  const chainConfigKeys: Record<number, string> = {};
  for (const id of chainIds) chainConfigKeys[id] = hashChainConfig(chainConfigs[id]!);

  /**
   * Per-(chain, solver) fingerprints for solver-facing query keys, precomputed
   * once. Building them also validates every solver: `assertSupportedSolver`
   * throws for an unknown `(kind, version)`, so a config can never point at a
   * solver the SDK has no client for (fail-fast, like the affiliate check above).
   */
  const solverConfigKeys: Record<number, Record<SolverId, string>> = {};
  for (const id of chainIds) {
    const perSolver: Record<SolverId, string> = {};
    for (const [solverId, solver] of Object.entries(chainConfigs[id]!.solvers)) {
      assertSupportedSolver(id, solverId, solver);
      perSolver[solverId] = hashSolverConfig(id, solverId, solver);
    }
    solverConfigKeys[id] = perSolver;
  }
  function getChainConfig(chainId?: number): SymmioChainConfig {
    const id = chainId ?? resolvedDefaultChainId;
    const config = chainConfigs[id];

    if (!config) throw new SymmError("config", "UNSUPPORTED_CHAIN", `Unsupported chain id: ${id}.`);
    return config;
  }

  function getChainConfigKey(chainId?: number): string {
    const id = chainId ?? resolvedDefaultChainId;
    return chainConfigKeys[id] ?? "unsupported";
  }

  function getSolver(parameters?: { chainId?: number; solverId?: SolverId }): SymmioSolverConfig {
    return resolveSolver(getChainConfig(parameters?.chainId), parameters?.solverId);
  }

  function getSolverKey(parameters?: { chainId?: number; solverId?: SolverId }): string {
    const id = parameters?.chainId ?? resolvedDefaultChainId;
    const chain = chainConfigs[id];
    if (!chain) return "unsupported-solver";
    const solverId = parameters?.solverId ?? chain.defaultSolverId;
    return solverConfigKeys[id]?.[solverId] ?? "unsupported-solver";
  }

  function getDefaultSolverId(chainId?: number): SolverId {
    return getChainConfig(chainId).defaultSolverId;
  }

  function listSolverIds(chainId?: number): readonly SolverId[] {
    return Object.keys(getChainConfig(chainId).solvers);
  }

  return {
    chains: chainIds,
    simulateBeforeWrite,
    defaultChainId: resolvedDefaultChainId,
    getChainConfig,
    getChainConfigKey,
    getSolver,
    getSolverKey,
    getDefaultSolverId,
    listSolverIds,
    getClient(clientParameters) {
      return getClient({ chainId: clientParameters?.chainId ?? resolvedDefaultChainId });
    },
    async getWalletClient(clientParameters) {
      if (!getWalletClient) {
        throw new SymmError(
          "config",
          "NO_WALLET_CLIENT",
          "createConfig: no `getWalletClient` resolver was provided; write/sign actions are unavailable.",
        );
      }
      return getWalletClient({
        chainId: clientParameters?.chainId ?? resolvedDefaultChainId,
        from: clientParameters?.from,
      });
    },
    getWebSocketConstructor() {
      const ctor = webSocketConstructor ?? (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket;
      if (!ctor)
        throw new SymmError(
          "config",
          "NO_WEBSOCKET",
          "No WebSocket implementation available. Pass `webSocketConstructor` to createConfig (e.g. the `ws` package in Node).",
        );
      return ctor;
    },
  };
}
