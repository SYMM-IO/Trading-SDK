import type { Account, Chain, PublicClient, Transport, WalletClient } from "viem";
import type { SymmioChainConfig } from "../chains";
import { SymmError } from "../errors";
import type { DeepPartial } from "../types/properties";
import { buildChainConfigs } from "./merge-chain-config";

/**
 * A bound viem `WalletClient` with an account and chain — what write actions
 * need. The react layer produces one from wagmi's `getWalletClient`.
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
   * Per-chain overrides deep-merged onto the SDK's built-in chain configs
   * (addresses, subgraphs, solver), keyed by chain id. Omit to use defaults.
   */
  chains?: Partial<Record<number, DeepPartial<SymmioChainConfig>>>;
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
}

/**
 * The immutable SDK config every action and query factory receives as its first
 * argument. Holds the per-chain registry and the viem-client resolvers.
 *
 * Mirrors wagmi's `Config`: stateless from the caller's view, with
 * `getClient({ chainId })` resolving a viem client. Connection state (which
 * wallet, which chain) is not owned here — the framework layer supplies it
 * through the resolvers and by passing `chainId` explicitly.
 */
export interface Config {
  /** Chain ids the config knows about (built-in defaults plus overrides). */
  readonly chains: readonly number[];
  /** Chain used when an action or query omits `chainId`. */
  readonly defaultChainId: number;
  /**
   * Resolve the fully-merged config for a chain.
   * @throws {SymmError} when the chain is not supported.
   */
  getChainConfig(chainId?: number): SymmioChainConfig;
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
  const { getClient, getWalletClient, chains: overrides, defaultChainId } = parameters;

  const chainConfigs = buildChainConfigs(overrides);
  const chainIds = Object.keys(chainConfigs).map(Number);
  if (chainIds.length === 0) {
    throw new SymmError("createConfig: no supported chains are configured.");
  }
  const resolvedDefaultChainId = defaultChainId ?? chainIds[0]!;

  function getChainConfig(chainId?: number): SymmioChainConfig {
    const id = chainId ?? resolvedDefaultChainId;
    const config = chainConfigs[id];
    if (!config) {
      throw new SymmError(`Unsupported chain id: ${id}.`);
    }
    return config;
  }

  return {
    chains: chainIds,
    defaultChainId: resolvedDefaultChainId,
    getChainConfig,
    getClient(clientParameters) {
      return getClient({ chainId: clientParameters?.chainId ?? resolvedDefaultChainId });
    },
    getWalletClient(clientParameters) {
      if (!getWalletClient) {
        return Promise.reject(
          new SymmError("createConfig: no `getWalletClient` resolver was provided; write actions are unavailable."),
        );
      }
      return getWalletClient({ chainId: clientParameters?.chainId ?? resolvedDefaultChainId });
    },
  };
}
