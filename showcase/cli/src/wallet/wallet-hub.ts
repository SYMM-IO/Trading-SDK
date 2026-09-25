import { createSessionKeyManager, type SessionKeyManager } from "@symmio/session-key";
import type { GetWalletClientFn, SymmioWalletClient } from "@symmio/trading-core";
import { createWalletClient, custom, http, type Account, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DEPLOYMENTS, getDeploymentByChainId } from "../config/deployments.js";
import {
  getEnvAddress,
  getEnvPrivateKey,
  getKeystoreDir,
  getRpcUrl,
  getWalletConnectRelayUrl,
} from "../config/environment.js";
import { createFileSessionKeyStorage } from "./session-key-store.js";
import { connectWalletConnect, type WalletConnectSession } from "./walletconnect.js";

/** How the main wallet signs — or that it cannot. */
export type SignerKind = "none" | "readonly" | "local" | "walletconnect";

/** Public, render-facing snapshot of the wallet hub. */
export interface SignerState {
  kind: SignerKind;
  /** The main wallet address — the `user` for sub-account reads. */
  address?: Address;
  /** Short human label for the status bar (`env key`, `read-only`, …). */
  label: string;
  /** Whether writes are possible (a private key or a WalletConnect session). */
  canSign: boolean;
  /** A connect flow is in progress. */
  connecting: boolean;
  /** The last connect error, if any. */
  error?: string;
  /** The delegated hot signer used for prompt-free instant trades. */
  sessionKeyAddress?: Address;
  /** Local hot-key expiry in epoch milliseconds; delegation must never outlive it. */
  sessionKeyExpiresAt?: number;
}

/**
 * The wallet hub is the terminal's single source of signing truth. It holds the
 * main-wallet signer (env private key or a WalletConnect session), owns the
 * file-backed session-key manager, and exposes {@link WalletHub.getWalletClient}
 * — the resolver `createConfig` calls for every write. The resolver routes by
 * the `from` hint: session-key address → the hot key (no prompt), otherwise the
 * main wallet. This mirrors `showcase/telegram`'s `use-app-wallet-client`.
 */
export interface WalletHub {
  getState: () => SignerState;
  subscribe: (listener: () => void) => () => void;
  /** The `getWalletClient` resolver handed to `createConfig`. */
  getWalletClient: GetWalletClientFn;
  /** Wire the signer from environment (`SYMMIO_PRIVATE_KEY` / `SYMMIO_ADDRESS`). */
  initFromEnv: () => Promise<void>;
  /** Connect a mobile wallet over WalletConnect, rendering `onUri` as a QR. */
  connectWalletConnect: (projectId: string, onUri: (uri: string) => void) => Promise<void>;
  /** Drop the current signer and fall back to the environment default. */
  disconnect: () => Promise<void>;
  /** Record a connection failure (e.g. a WalletConnect crash) and reset state. */
  noteConnectionError: (message: string) => void;
  sessionKeys: SessionKeyManager;
}

function createWalletHub(): WalletHub {
  const sessionKeys = createSessionKeyManager({ storage: createFileSessionKeyStorage(getKeystoreDir()) });

  let state: SignerState = { kind: "none", label: "not connected", canSign: false, connecting: false };
  let localAccount: Account | undefined;
  let wcSession: WalletConnectSession | undefined;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function setState(patch: Partial<SignerState>): void {
    state = { ...state, ...patch };
    notify();
  }

  async function beginSession(owner: Address): Promise<void> {
    try {
      const session = await sessionKeys.initialize(owner);
      setState({
        sessionKeyAddress: session.publicAddress ?? undefined,
        sessionKeyExpiresAt: session.expiresAt ?? undefined,
      });
    } catch {
      setState({ sessionKeyAddress: undefined, sessionKeyExpiresAt: undefined });
    }
  }

  async function clearSigner(): Promise<void> {
    if (wcSession) {
      await wcSession.disconnect().catch(() => undefined);
      wcSession = undefined;
    }
    localAccount = undefined;
    await sessionKeys.destroy().catch(() => undefined);
  }

  return {
    sessionKeys,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getWalletClient: (async ({ chainId, from }) => {
      const deployment = getDeploymentByChainId(chainId);
      const rpcUrl = getRpcUrl(chainId);
      const sessionAddress = sessionKeys.getAddress();
      if (from && sessionAddress && from.toLowerCase() === sessionAddress.toLowerCase()) {
        const sessionState = sessionKeys.getState();
        if (!sessionState.expiresAt || sessionState.expiresAt <= Date.now()) {
          throw new Error("The local session key expired. Reconnect the wallet to rotate it before trading.");
        }
        const sessionAccount = sessionKeys.getAccount();
        if (!sessionAccount) throw new Error("Session key matched but no key is loaded — enable trading first.");
        return createWalletClient({
          account: sessionAccount,
          chain: deployment.chain,
          transport: http(rpcUrl),
        }) as unknown as SymmioWalletClient;
      }
      if (localAccount) {
        return createWalletClient({
          account: localAccount,
          chain: deployment.chain,
          transport: http(rpcUrl),
        }) as unknown as SymmioWalletClient;
      }
      if (wcSession) {
        await wcSession.switchChain(chainId);
        return createWalletClient({
          account: wcSession.address,
          chain: deployment.chain,
          transport: custom(wcSession.provider),
        }) as unknown as SymmioWalletClient;
      }
      throw new Error("No wallet connected. Set SYMMIO_PRIVATE_KEY or connect a wallet (press w).");
    }) satisfies GetWalletClientFn,

    async initFromEnv() {
      const privateKey = getEnvPrivateKey();
      if (privateKey) {
        localAccount = privateKeyToAccount(privateKey);
        setState({ kind: "local", address: localAccount.address, label: "env key", canSign: true, error: undefined });
        await beginSession(localAccount.address);
        return;
      }
      const address = getEnvAddress();
      if (address) {
        setState({ kind: "readonly", address, label: "read-only", canSign: false, error: undefined });
        return;
      }
      setState({ kind: "none", label: "not connected", canSign: false });
    },

    async connectWalletConnect(projectId, onUri) {
      setState({ connecting: true, error: undefined });
      try {
        await clearSigner();
        setState({ sessionKeyAddress: undefined, sessionKeyExpiresAt: undefined });
        wcSession = await connectWalletConnect({
          projectId,
          chainIds: DEPLOYMENTS.map((deployment) => deployment.chainId),
          rpcMap: Object.fromEntries(
            DEPLOYMENTS.map((deployment) => [deployment.chainId, getRpcUrl(deployment.chainId)]),
          ),
          relayUrl: getWalletConnectRelayUrl(),
          onUri,
        });
        setState({
          kind: "walletconnect",
          address: wcSession.address,
          label: "WalletConnect",
          canSign: true,
          connecting: false,
        });
        await beginSession(wcSession.address);
      } catch (error) {
        setState({
          kind: "none",
          address: undefined,
          label: "not connected",
          canSign: false,
          connecting: false,
          sessionKeyAddress: undefined,
          sessionKeyExpiresAt: undefined,
          error: error instanceof Error ? error.message : "WalletConnect failed",
        });
        throw error;
      }
    },

    async disconnect() {
      await clearSigner();
      setState({
        kind: "none",
        address: undefined,
        label: "not connected",
        canSign: false,
        sessionKeyAddress: undefined,
        sessionKeyExpiresAt: undefined,
      });
      await this.initFromEnv();
    },

    noteConnectionError(message) {
      if (wcSession) {
        void wcSession.disconnect().catch(() => undefined);
        wcSession = undefined;
      }
      const wasWalletConnect = state.kind === "walletconnect";
      setState({ connecting: false, error: message });
      if (wasWalletConnect) {
        setState({
          kind: "none",
          address: undefined,
          label: "not connected",
          canSign: false,
          sessionKeyAddress: undefined,
          sessionKeyExpiresAt: undefined,
        });
      }
    },
  };
}

/** The process-wide wallet hub singleton. */
export const walletHub = createWalletHub();
