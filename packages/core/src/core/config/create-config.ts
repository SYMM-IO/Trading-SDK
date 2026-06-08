import type { Account, Chain, PublicClient, Transport, WalletClient } from "viem";
import { SymmError } from "../../shared/errors/symm-error";
import type { DeepPartial } from "../../shared/types/properties";
import type { SymmioChainConfig } from "../chains";
import { hashChainConfig } from "./config-key";
import { buildChainConfigs } from "./merge-chain-config";

/**
 * A bound viem `WalletClient` with an account and chain — what write actions
 * need. The consuming layer supplies one through {@link GetWalletClientFn}.
 */
export type SymmioWalletClient = WalletClient<Transport, Chain, Account>;

/** Resolve a viem `PublicClient` for reads, optionally for a specific chain. */
export type GetClientFn = (parameters?: { chainId?: number }) => PublicClient;

/** Resolve a bound viem `WalletClient` for writes, optionally for a specific chain. */
export type GetWalletClientFn = (parameters?: { chainId?: number }) => Promise<SymmioWalletClient>;

/**
 * Parameters for {@link createConfig}.
 */
export interface CreateConfigParameters {
  /**
   * Per-chain overrides deep-merged onto the SDK's built-in chain configs,
   * keyed by chain id. Omit to use defaults.
   */
  chainOverrides?: Partial<Record<number, DeepPartial<SymmioChainConfig>>>;
  /**
   * Returns the viem `PublicClient` used for read actions. Framework layers
   * inject this — e.g. `@symm-frontier/react` bridges it to wagmi's
   * `getPublicClient`. In a plain Node script, return your own viem client.
   */
  getClient: GetClientFn;
  /**
   * Returns the bound viem `WalletClient` used for write actions. Optional —
   * read-only configs may omit it; write actions then throw a {@link SymmError}.
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
}

/**
 * The immutable SDK config every action and query factory receives as its first
 * argument. Holds the per-chain registry and the viem-client resolvers.
 *
 * Stateless from the caller's view: `getClient({ chainId })` resolves a viem
 * client on demand. Connection state (which wallet, which chain) is not owned
 * here — the consuming layer supplies it through the resolvers and by passing
 * `chainId` explicitly.
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
   * Stable fingerprint of a chain's fully-resolved config (addresses, solver,
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
  /** Resolve the viem `PublicClient` for reads on a chain. */
  getClient(parameters?: { chainId?: number }): PublicClient;
  /**
   * Resolve the bound viem `WalletClient` for writes on a chain.
   * @throws {SymmError} when the config was created without a `getWalletClient`.
   */
  getWalletClient(parameters?: { chainId?: number }): Promise<SymmioWalletClient>;
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
 * @param parameters - Client resolvers, optional per-chain overrides, and an
 *   optional default chain.
 * @returns An immutable config to pass as the first argument of every action.
 *
 * @example Plain viem (Node)
 * ```ts
 * import { createConfig, SymmioSupportedChainId } from "@symm-frontier/core";
 * import { createPublicClient, http } from "viem";
 * import { hyperEvm } from "viem/chains";
 *
 * const publicClient = createPublicClient({ chain: hyperEvm, transport: http() });
 * const config = createConfig({ getClient: () => publicClient });
 * const markets = await getMarkets(config, {});
 * ```
 */
export function createConfig(parameters: CreateConfigParameters): Config {
  const { getClient, getWalletClient, chainOverrides, defaultChainId, simulateBeforeWrite = true } = parameters;

  const chainConfigs = buildChainConfigs(chainOverrides);

  const chainIds = Object.keys(chainConfigs).map(Number);
  if (chainIds.length === 0)
    throw new SymmError("config", "NO_CHAINS_CONFIGURED", "createConfig: no supported chains are configured.");
  const resolvedDefaultChainId = defaultChainId ?? chainIds[0]!;

  /** Per-chain config fingerprints, precomputed once from the resolved registry. */
  const chainConfigKeys: Record<number, string> = {};
  for (const id of chainIds) chainConfigKeys[id] = hashChainConfig(chainConfigs[id]!);

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

  return {
    chains: chainIds,
    simulateBeforeWrite,
    defaultChainId: resolvedDefaultChainId,
    getChainConfig,
    getChainConfigKey,
    getClient(clientParameters) {
      return getClient({ chainId: clientParameters?.chainId ?? resolvedDefaultChainId });
    },
    async getWalletClient(clientParameters) {
      if (!getWalletClient) {
        throw new SymmError(
          "config",
          "NO_WALLET_CLIENT",
          "createConfig: no `getWalletClient` resolver was provided; write actions are unavailable.",
        );
      }

      return getWalletClient({ chainId: clientParameters?.chainId ?? resolvedDefaultChainId });
    },
  };
}
