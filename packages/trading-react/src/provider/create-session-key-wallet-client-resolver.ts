import { SymmError, type GetWalletClientFn, type SymmioWalletClient } from "@symmio/trading-core";
import { createWalletClient, custom, http, type Account, type Address, type Chain, type Transport } from "viem";
import type { Config as WagmiConfig } from "wagmi";
import { getClient, getWalletClient } from "wagmi/actions";

/**
 * Parameters for {@link createSessionKeyWalletClientResolver}.
 */
export interface CreateSessionKeyWalletClientResolverParameters {
  /** Returns the session-key account to sign with, or null when no key is loaded. */
  getSessionAccount: () => Account | null;
  /** The wagmi config used to resolve the connected wallet and the target chain. */
  wagmiConfig: WagmiConfig;
  /** Optional per-chain transport override for the session-key client. Defaults to wagmi's transport for that chain. */
  transport?: (chainId: number) => Transport;
}

/**
 * Case-insensitive address comparison. Addresses reach the SDK from many
 * sources (contract reads, notifications, user input) with inconsistent EIP-55
 * checksumming, so equality must never depend on casing.
 */
function isSameAddress(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Resolve the viem `Chain` object for `chainId` from the wagmi config.
 *
 * @throws {SymmError} `UNSUPPORTED_CHAIN` when the wagmi config knows no such chain.
 */
function resolveChain(wagmiConfig: WagmiConfig, chainId: number): Chain {
  const chain = wagmiConfig.chains.find((candidate) => candidate.id === chainId);

  if (!chain)
    throw new SymmError(
      "config",
      "UNSUPPORTED_CHAIN",
      `Chain ${chainId} is not registered in the wagmi config, so no session-key wallet client can be built for it.`,
    );
  return chain;
}

/**
 * Resolve the transport the session-key client should use for `chainId`.
 *
 * Prefers the transport the host already configured in wagmi for that chain —
 * reached through the supported `getClient` accessor — so the session key talks
 * to the app's own RPCs (custom endpoints, API keys, fallbacks, batching)
 * instead of viem's public default. A bare `http()` is only the last resort for
 * a chain wagmi has no client for.
 */
function resolveTransport(
  wagmiConfig: WagmiConfig,
  chainId: number,
  override?: (chainId: number) => Transport,
): Transport {
  if (override) return override(chainId);

  const client = getClient(wagmiConfig, { chainId });
  if (!client) return http();

  /**
   * `client.transport` is an already-instantiated transport, not a transport
   * factory, so it cannot be handed to `createWalletClient` directly. Wrapping
   * its EIP-1193 `request` in `custom` re-packages it as a factory while keeping
   * every configured behavior (URL, headers, retries, fallback order) intact.
   */
  return custom({ request: client.transport.request });
}

/**
 * Build the wallet client that signs with the loaded session-key account.
 */
function createSessionKeyClient(parameters: {
  account: Account;
  chainId: number;
  wagmiConfig: WagmiConfig;
  transport?: (chainId: number) => Transport;
}): SymmioWalletClient {
  const { account, chainId, wagmiConfig, transport } = parameters;

  return createWalletClient({
    account,
    chain: resolveChain(wagmiConfig, chainId),
    transport: resolveTransport(wagmiConfig, chainId, transport),
  });
}

/**
 * Resolve the wagmi-connected wallet client, normalizing wagmi's own failure
 * into the SDK's `NO_WALLET_CONNECTED` error.
 *
 * @throws {SymmError} `NO_WALLET_CONNECTED` when no wallet is connected.
 */
async function getConnectedWalletClient(wagmiConfig: WagmiConfig, chainId: number): Promise<SymmioWalletClient> {
  try {
    return await getWalletClient(wagmiConfig, { chainId });
  } catch (err) {
    throw new SymmError(
      "config",
      "NO_WALLET_CONNECTED",
      "No connected wallet. Connect a wallet before sending transactions.",
      { cause: err instanceof Error ? err : undefined },
    );
  }
}

/**
 * Build a {@link GetWalletClientFn} that routes the SDK's `from` hint to a
 * session-key signer, falling back to the wagmi-connected wallet.
 *
 * Pass the result as `SymmioProvider`'s `getWalletClient` prop. Every SDK write
 * that can be relayed gaslessly asks the resolver for a signer and passes the
 * `from` address it wants; with this resolver installed, a `from` that matches
 * the loaded session key is signed in-memory with **no wallet prompt**, while
 * any other `from` (typically the account owner) keeps using the connected
 * wallet.
 *
 * The session-key client is bound to the transport the host configured in wagmi
 * for that chain, so it uses the app's RPCs rather than viem's public defaults.
 *
 * Unlike the provider's default resolver, an unresolvable `from` is a loud
 * error: it never falls back to prompting the connected wallet, because the
 * owner is also authorized on-chain and the write would silently succeed with
 * the wrong signer.
 *
 * The factory takes a `getSessionAccount` callback rather than a session-key
 * manager on purpose — `@symmio/trading-react` must not depend on
 * `@symmio/session-key`, and the callback is read fresh on every call so
 * loading, rotating, or clearing the key needs no new resolver.
 *
 * @param parameters - See {@link CreateSessionKeyWalletClientResolverParameters}.
 * @returns A resolver suitable for `SymmioProvider`'s `getWalletClient` prop.
 * @throws {SymmError} `UNSUPPORTED_CHAIN` when the requested chain is not in the
 *   wagmi config, `SESSION_SIGNER_UNAVAILABLE` when `from` matches neither the
 *   loaded session key nor the connected wallet, and `NO_WALLET_CONNECTED` when
 *   the fallback path finds no connected wallet.
 *
 * @example
 * ```tsx
 * function Providers({ children }: { children: ReactNode }) {
 *   const wagmiConfig = useConfig();
 *   const getWalletClient = useMemo(
 *     () =>
 *       createSessionKeyWalletClientResolver({
 *         wagmiConfig,
 *         getSessionAccount: () => sessionKeyManager.getAccount(),
 *       }),
 *     [wagmiConfig],
 *   );
 *
 *   return (
 *     <SymmioProvider symmioConfig={symmioConfig} getWalletClient={getWalletClient}>
 *       {children}
 *     </SymmioProvider>
 *   );
 * }
 * ```
 */
export function createSessionKeyWalletClientResolver(
  parameters: CreateSessionKeyWalletClientResolverParameters,
): GetWalletClientFn {
  const { getSessionAccount, wagmiConfig, transport } = parameters;

  return async ({ chainId, from }) => {
    const sessionAccount = getSessionAccount();

    if (from && sessionAccount && isSameAddress(from, sessionAccount.address))
      return createSessionKeyClient({ account: sessionAccount, chainId, wagmiConfig, transport });

    /**
     * `from` is a hint, and the account owner is a legitimate value for it — an
     * owner `from` resolves here through the connected wallet and must not
     * throw. Only a `from` that matches neither available signer is an error.
     */
    const walletClient = await getConnectedWalletClient(wagmiConfig, chainId);

    if (from && !isSameAddress(from, walletClient.account.address))
      throw new SymmError(
        "config",
        "SESSION_SIGNER_UNAVAILABLE",
        `Cannot sign as ${from}: it is neither the connected wallet (${walletClient.account.address}) nor the loaded session key (${sessionAccount ? sessionAccount.address : "none loaded"}). Load the session key for that address, or the action would be signed by the wrong signer.`,
      );

    return walletClient;
  };
}
