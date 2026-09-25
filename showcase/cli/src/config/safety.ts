import { walletHub } from "../wallet/wallet-hub.js";

/**
 * WalletConnect's provider runs its own async event loop (relay socket, session
 * events, chain switching) and can throw from a handler we don't control — for
 * example when a paired wallet emits `chainChanged` for an unsupported chain.
 * Uncaught, that would kill the whole terminal.
 *
 * These guards swallow **only** WalletConnect-originated errors, surface them in
 * the wallet UI, and keep the app alive. Any other uncaught error still fails
 * fast so real bugs are not hidden.
 */
const WC_ERROR = /@?walletconnect|universal-provider|ethereum-provider|sign-client|relay/i;
const WC_MESSAGE =
  "WalletConnect error — the wallet may not support the selected chain. Try again, or sign with SYMMIO_PRIVATE_KEY.";

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.message}\n${error.stack ?? ""}`;
  return String(error);
}

function isWalletConnectError(error: unknown): boolean {
  return WC_ERROR.test(describe(error));
}

process.on("uncaughtException", (error) => {
  if (isWalletConnectError(error)) {
    walletHub.noteConnectionError(WC_MESSAGE);
    return;
  }
  process.stderr.write(`\nUncaught error: ${describe(error)}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (isWalletConnectError(reason)) {
    walletHub.noteConnectionError(WC_MESSAGE);
    return;
  }
  process.stderr.write(`\nUnhandled rejection: ${describe(reason)}\n`);
});
