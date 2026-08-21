"use client";

import { wagmiConfig } from "@/config/wagmi";
import { SymmError, type GetWalletClientFn, type SymmioWalletClient } from "@symmio/trading-react";
import { useCallback } from "react";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getWalletClient } from "wagmi/actions";
import { getSessionKeyManager } from "./use-session-key";

/**
 * The app's signer resolver, handed to `SymmioProvider`.
 *
 * This one function is what makes instant trading instant. Every SDK write
 * carries a `from` address, and the SDK asks the host app which client can sign
 * for it. Return the session-key client when `from` is the session key, and the
 * connected wallet otherwise — so an order signs locally with no popup, while a
 * deposit, a withdrawal or the delegation grant itself still goes through the
 * wallet, as it must.
 *
 * Omit this and the SDK falls back to the connected wallet for everything,
 * which means one wallet prompt per order on Rasa and **two** on Enigma (the
 * adapter signs `addMarginToNextVA` and `sendQuote` as separate operations).
 */
export function usePrismWalletClient(): GetWalletClientFn {
  return useCallback<GetWalletClientFn>(async ({ chainId, from }) => {
    const manager = getSessionKeyManager();
    const sessionAddress = manager.getAddress();
    const wantsSessionKey = from && sessionAddress && from.toLowerCase() === sessionAddress.toLowerCase();

    if (wantsSessionKey) {
      const privateKey = manager.getPrivateKey();
      if (!privateKey) {
        throw new SymmError(
          "config",
          "SESSION_KEY_NOT_LOADED",
          "The requested signer is this wallet's session key, but no key is loaded. Reconnect to restore it.",
        );
      }

      const chain = wagmiConfig.chains.find((candidate) => candidate.id === chainId);
      if (!chain) {
        throw new SymmError("config", "UNSUPPORTED_CHAIN", `Unsupported chain id: ${chainId}.`);
      }

      /* The session key holds no funds and pays no gas — it only produces
         EIP-712 signatures the solver relays — so a plain HTTP transport is all
         it needs. */
      return createWalletClient({
        account: privateKeyToAccount(privateKey),
        chain,
        transport: http(),
      }) as unknown as SymmioWalletClient;
    }

    try {
      return await getWalletClient(wagmiConfig, { chainId });
    } catch (cause) {
      throw new SymmError("config", "NO_WALLET_CONNECTED", "No connected wallet. Connect one before signing.", {
        cause: cause instanceof Error ? cause : undefined,
      });
    }
  }, []);
}
