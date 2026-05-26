"use client";

import { useConnectWallet, useDisconnectWallet, useSwitchToSymmioChain, useWalletAccount } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@symm-frontier/ui/components/card";
import { shortenAddress } from "@symm-frontier/utils";
import { ReadGetUserSubAccounts } from "./read-get-user-sub-accounts";
import { WriteEditAccountName } from "./write-edit-account-name";

/**
 * Top-level shell for the Inspector page. Mirrors Explorer's `AccountLayerView`
 * shape — header with connection status, method sections beneath. Two methods
 * only in this slice; the grid layout is ready to grow as more wrappers land.
 */
export function InspectorShell() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3">
        <Badge variant="outline" className="self-start">
          Symmio SDK · Inspector
        </Badge>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">AccountLayer · HyperEVM</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-6">
          Live integration target for the SYMMIO React SDK. Connect a wallet, pick a method, run it against the
          production AccountLayer deployment.
        </p>
      </header>

      <WalletPanel />

      <ReadGetUserSubAccounts />
      <WriteEditAccountName />
    </section>
  );
}

function WalletPanel() {
  const { address, isConnected, isOnExpectedChain } = useWalletAccount();
  const { connectors, connect, status: connectStatus } = useConnectWallet();
  const { disconnect } = useDisconnectWallet();
  const { switchChain, status: switchStatus } = useSwitchToSymmioChain();

  return (
    <Card data-testid="wallet-panel" size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardDescription className="text-xs tracking-wide uppercase">Wallet</CardDescription>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle data-testid="wallet-address" className="font-mono text-sm">
                {address ? shortenAddress(address) : "Not connected"}
              </CardTitle>
              {isConnected && isOnExpectedChain && <Badge>Connected</Badge>}
              {isConnected && !isOnExpectedChain && <Badge variant="destructive">Wrong network</Badge>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isConnected &&
              connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  type="button"
                  size="sm"
                  onClick={() => connect(connector).catch(() => undefined)}
                  disabled={connectStatus === "pending"}
                  data-testid={`connect-${connector.id}`}
                >
                  Connect {connector.name}
                </Button>
              ))}

            {isConnected && !isOnExpectedChain && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => switchChain().catch(() => undefined)}
                disabled={switchStatus === "pending"}
                data-testid="switch-chain"
              >
                Switch to HyperEVM
              </Button>
            )}

            {isConnected && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => disconnect().catch(() => undefined)}
                data-testid="disconnect"
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
