"use client";

import { wagmiConfig } from "@/config/wagmi";
import { getAppSessionKeyManager } from "@/features/session-keys/session-key-manager";
import { SymmError, type GetWalletClientFn, type SymmioWalletClient } from "@symmio/trading-react";
import { useCallback } from "react";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getWalletClient as getWagmiWalletClient } from "wagmi/actions";

/**
 * Builds the app's wallet-client resolver: when `from` matches the in-memory
 * session key, sign with the session-key viem client; otherwise fall back to the
 * wagmi-connected EOA.
 *
 * Extracted from the provider tree so a popped-out method window can re-supply
 * `SymmioProvider` in its own React root with the same signer behavior.
 */
export function useAppGetWalletClient(): GetWalletClientFn {
  return useCallback<GetWalletClientFn>(async ({ chainId, from }) => {
    const manager = getAppSessionKeyManager();
    const sessionAddress = manager.getAddress();
    const wantsSession = from && sessionAddress && from.toLowerCase() === sessionAddress.toLowerCase();

    if (wantsSession) {
      const privateKey = manager.getPrivateKey();
      if (!privateKey) {
        throw new SymmError(
          "config",
          "SESSION_KEY_NOT_LOADED",
          "Session key matched the requested signer but no private key is loaded.",
        );
      }
      const chain = wagmiConfig.chains.find((c) => c.id === chainId);
      if (!chain) {
        throw new SymmError("config", "UNSUPPORTED_CHAIN", `Unsupported chain id: ${chainId}.`);
      }
      const account = privateKeyToAccount(privateKey);
      return createWalletClient({ account, chain, transport: http() }) as unknown as SymmioWalletClient;
    }

    try {
      return await getWagmiWalletClient(wagmiConfig, { chainId });
    } catch (err) {
      throw new SymmError(
        "config",
        "NO_WALLET_CONNECTED",
        "No connected wallet. Connect a wallet before sending transactions.",
        { cause: err instanceof Error ? err : undefined },
      );
    }
  }, []);
}
