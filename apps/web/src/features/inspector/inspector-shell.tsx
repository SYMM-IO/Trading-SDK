"use client";

import {
  useConnectWallet,
  useDisconnectWallet,
  useSwitchToSymmioChain,
  useWalletAccount,
} from "@symm-frontier/react";
import { shortenAddress } from "@symm-frontier/utils/address";
import { ReadGetUserSubAccounts } from "./read-get-user-sub-accounts";
import { WriteEditAccountName } from "./write-edit-account-name";

/**
 * Top-level shell for the Inspector page. Mirrors Explorer's `AccountLayerView`
 * shape — header with connection status, method sections beneath. Two methods
 * only in this slice; the grid layout is ready to grow as more wrappers land.
 */
export function InspectorShell() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-400">
          Symmio SDK · Inspector
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          AccountLayer · HyperEVM
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Live integration target for the SYMMIO React SDK. Connect a wallet, pick a method, run it against the
          production AccountLayer deployment.
        </p>
      </header>

      <WalletPanel />

      <ReadGetUserSubAccounts />
      <WriteEditAccountName />
    </main>
  );
}

function WalletPanel() {
  const { address, isConnected, isOnExpectedChain } = useWalletAccount();
  const { connectors, connect, status: connectStatus } = useConnectWallet();
  const { disconnect } = useDisconnectWallet();
  const { switchChain, status: switchStatus } = useSwitchToSymmioChain();

  return (
    <section
      data-testid="wallet-panel"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Wallet</span>
          <span className="font-mono text-sm text-zinc-950 dark:text-zinc-50" data-testid="wallet-address">
            {address ? shortenAddress(address) : "Not connected"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isConnected &&
            connectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                onClick={() => connect(connector).catch(() => undefined)}
                disabled={connectStatus === "pending"}
                data-testid={`connect-${connector.id}`}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                Connect {connector.name}
              </button>
            ))}

          {isConnected && !isOnExpectedChain && (
            <button
              type="button"
              onClick={() => switchChain().catch(() => undefined)}
              disabled={switchStatus === "pending"}
              data-testid="switch-chain"
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-400 disabled:opacity-60"
            >
              Switch to HyperEVM
            </button>
          )}

          {isConnected && (
            <button
              type="button"
              onClick={() => disconnect().catch(() => undefined)}
              data-testid="disconnect"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
