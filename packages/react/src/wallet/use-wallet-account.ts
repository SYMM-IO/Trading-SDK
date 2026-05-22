"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Wallet account state surfaced by the SYMMIO React SDK.
 */
export interface UseWalletAccountResult {
  /** Connected EVM wallet address, if any. */
  address?: Address;
  /** Wagmi's active chain id, or `undefined` before connect. */
  chainId?: number;
  /** Whether wagmi reports a currently connected wallet. */
  isConnected: boolean;
  /** Whether wagmi is mid-reconnect after a page reload. */
  isReconnecting: boolean;
  /**
   * Whether the connected wallet's chain matches the SDK's configured chain.
   * `false` when disconnected.
   */
  isOnExpectedChain: boolean;
}

/**
 * Read the active wallet's connection state, normalized to the SDK shape. Adds
 * `isOnExpectedChain` on top of wagmi's `useAccount` so UIs can decide whether
 * to render a "switch network" prompt without re-comparing chain ids in every
 * component.
 *
 * @example
 * const { address, isOnExpectedChain } = useWalletAccount();
 * if (!address) return <ConnectButton />;
 * if (!isOnExpectedChain) return <SwitchNetworkPrompt />;
 */
export function useWalletAccount(): UseWalletAccountResult {
  const config = useSymmioConfig();
  const { address, chainId, isConnected, isReconnecting } = useAccount();

  return {
    address,
    chainId,
    isConnected,
    isReconnecting,
    isOnExpectedChain: isConnected && chainId === config.chainId,
  };
}
