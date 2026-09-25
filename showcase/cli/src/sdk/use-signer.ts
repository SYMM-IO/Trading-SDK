import { useSyncExternalStore } from "react";
import { walletHub, type SignerState } from "../wallet/wallet-hub.js";

/**
 * Subscribe to the wallet hub's signer state. Re-renders whenever the main
 * wallet or the session key changes (connect, disconnect, session ready).
 */
export function useSigner(): SignerState {
  return useSyncExternalStore(walletHub.subscribe, walletHub.getState, walletHub.getState);
}
