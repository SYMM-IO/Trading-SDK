import type { Address, PublicClient } from "viem";
import { SymmError } from "../../shared/errors/symm-error";
import type { DeepPartial } from "../../shared/types/properties";
import type { SymmioChainConfig } from "../chains";
import { hashChainConfig } from "./config-key";
import { buildChainConfigs } from "./merge-chain-config";
import type { SymmioWalletClient } from "./types";

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
   * Resolve the wallet client for writes / off-chain signs.
   *
   * Forwards `chainId` (defaulting to `defaultChainId`) and the optional
   * `from` to the consumer's `getWalletClient` resolver. The resolver decides
   * which wallet to return; the SDK does not perform address matching.
   *
   * @throws {SymmError} when the config was created without `getWalletClient`.
   */
  getWalletClient(parameters?: { chainId?: number; from?: Address }): Promise<SymmioWalletClient>;
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
 * import { createConfig } from "@symm-frontier/core";
 * import { createPublicClient, createWalletClient, http } from "viem";
 * import { hyperEvm } from "viem/chains";
 *
 * const publicClient = createPublicClient({ chain: hyperEvm, transport: http() });
 * const walletClient = createWalletClient({ account, chain: hyperEvm, transport: http() });
 *
 * const config = createConfig({
 *   getClient: () => publicClient,
 *   getWalletClient: async () => walletClient,
 * });
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
          "createConfig: no `getWalletClient` resolver was provided; write/sign actions are unavailable.",
        );
      }
      return getWalletClient({
        chainId: clientParameters?.chainId ?? resolvedDefaultChainId,
        from: clientParameters?.from,
      });
    },
  };
}
