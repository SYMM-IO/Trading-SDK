"use client";

import type { Address } from "viem";
import { useAccount } from "wagmi";

/**
 * Wallet account state exposed by the SYMMIO React SDK.
 */
export interface SymmioWalletAccount {
  /** Connected EVM wallet address, if a wallet is connected. */
  address?: Address;
  /** Active wallet chain id reported by Wagmi. */
  chainId?: number;
  /** Whether Wagmi currently has a connected wallet account. */
  isConnected: boolean;
  /** Whether Wagmi is currently reconnecting to a wallet account. */
  isReconnecting: boolean;
}

/**
 * Reads the active user wallet account from Wagmi.
 */
export function useWalletAccount(): SymmioWalletAccount {
  const { address, chainId, isConnected, isReconnecting } = useAccount();

  return {
    address,
    chainId,
    isConnected,
    isReconnecting,
  };
}
