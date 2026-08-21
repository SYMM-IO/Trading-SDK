"use client";

import type { Deployment } from "@/config/deployments";
import { normalizeSymmError, useWalletAccount, type SymmioRequestError } from "@symmio/trading-react";
import { useCallback, useState } from "react";
import { useChains, useSwitchChain } from "wagmi";

export interface ChainGate {
  /** True when the wallet already sits on this deployment's chain. */
  ready: boolean;
  /** True when the wallet is elsewhere, so a write here would fail. */
  needsSwitch: boolean;
  /** True while the wallet is showing its switch-network prompt. */
  isSwitching: boolean;
  /** Ask the wallet to move to this deployment's chain. */
  switchToDeployment: () => Promise<void>;
  /** Human name of the chain to switch to, for button copy. */
  targetName: string;
  /** Why the last switch attempt failed, if it did. */
  error: SymmioRequestError | null;
}

/**
 * Guard a deployment's **wallet-broadcast** writes behind the wallet being on
 * its chain.
 *
 * Reads resolve on both chains at once — the wagmi config carries a transport
 * for each, and `SymmioProvider` bridges the SDK's `getClient` to them. A
 * transaction the wallet sends cannot cross over the same way: its signature is
 * EIP-155-bound to one chain id, so wagmi's `getConnectorClient` refuses with
 * `ConnectorChainMismatchError` before anything is built. That is what this
 * gates — deposits, withdrawals, allocation, margin, account management, quote
 * cancels, and the delegation grants — and the user gets a switch button rather
 * than a dead one.
 *
 * It must **not** gate the instant-trade family: an open, a close, or a TP/SL is
 * an EIP-712 signature made by the local session key and relayed to the solver
 * over HTTP (`usePrismWalletClient` short-circuits to a `privateKeyToAccount`
 * client and never calls wagmi), so no wallet is in a position to object and the
 * SDK's per-method `chainId` is already sufficient to address the right
 * deployment. Gating those blocked a HyperEVM close from a wallet parked on
 * Base — exactly the case the session key exists to serve.
 *
 * The SDK's own `useSwitchToSymmioChain` always targets `config.defaultChainId`,
 * which is one fixed chain; a multi-deployment app has to name the chain per
 * write, so this drops to wagmi's `useSwitchChain`. The target id comes from
 * `useChains()` rather than a literal, both to avoid a magic chain id and to
 * pick up the config's own literal-union type for the mutation variable.
 */
export function useChainGate(deployment: Deployment | undefined): ChainGate {
  /* The wallet's chain, not the SDK's. `useSymmioChainId` falls back to the
     config's first chain when nothing is connected, so gating on it would
     report "ready" for a visitor with no wallet at all. */
  const { chainId, isConnected } = useWalletAccount();
  const chains = useChains();
  const { mutateAsync, status } = useSwitchChain();
  const [error, setError] = useState<SymmioRequestError | null>(null);

  const target = chains.find((chain) => chain.id === deployment?.chainId);

  const switchToDeployment = useCallback(async () => {
    setError(null);
    if (!target) {
      setError(
        normalizeSymmError(
          new Error(`${deployment?.chainName ?? "That chain"} is not in this app's wallet configuration.`),
        ),
      );
      return;
    }
    try {
      await mutateAsync({ chainId: target.id });
    } catch (cause) {
      /* A dismissed network prompt is an ordinary outcome, not a crash. Left
         unhandled it became an unhandled rejection and the button simply
         stopped spinning with nothing said. */
      setError(normalizeSymmError(cause));
    }
  }, [mutateAsync, target, deployment?.chainName]);

  const ready = Boolean(deployment) && isConnected && chainId === deployment?.chainId;

  return {
    ready,
    needsSwitch: Boolean(deployment) && !ready,
    isSwitching: status === "pending",
    switchToDeployment,
    targetName: deployment?.chainName ?? "",
    error,
  };
}
