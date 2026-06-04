"use client";

import { AddressTag } from "@/components/address-tag";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { useConnectWallet, useDisconnectWallet, useSwitchToSymmioChain, useWalletAccount } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Card } from "@symm-frontier/ui/components/card";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { cn } from "@symm-frontier/ui/lib/utils";
import { useState, type ReactNode } from "react";
import { ReadGetSubAccount } from "./read-get-sub-account";
import { ReadGetSubAccountVirtualNonce } from "./read-get-sub-account-virtual-nonce";
import { ReadGetSubAccountsCountOfUser } from "./read-get-sub-accounts-count-of-user";
import { ReadGetUserSubAccounts } from "./read-get-user-sub-accounts";
import { ReadGetUserSubAccountsAddresses } from "./read-get-user-sub-accounts-addresses";
import { WriteCreateSubAccounts } from "./write-create-sub-accounts";
import { WriteEditAccountName } from "./write-edit-account-name";

/**
 * Top-level shell for the Inspector page. Mirrors Explorer's `AccountLayerView`
 * shape — header with connection status, then read methods, then write methods.
 */
export function InspectorShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="Inspector · React SDK"
        title="AccountLayer · HyperEVM"
        description="Live integration target for the SYMMIO React SDK. Connect a wallet, pick a method, and run it against the production AccountLayer deployment."
      />

      <WalletPanel />

      <MethodGroup label="Reads" count={5}>
        <ReadGetSubAccount />
        <ReadGetSubAccountsCountOfUser />
        <ReadGetSubAccountVirtualNonce />
        <ReadGetUserSubAccounts />
        <ReadGetUserSubAccountsAddresses />
      </MethodGroup>

      <MethodGroup label="Writes" count={2}>
        <WriteCreateSubAccounts />
        <WriteEditAccountName />
      </MethodGroup>
    </section>
  );
}

function MethodGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const contentId = `methods-${label.toLowerCase()}`;

  return (
    <div className="animate-enter-up flex flex-col">
      <h2 className="text-xs font-medium tracking-[0.18em] uppercase">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 group/sec flex w-full items-center gap-3 rounded-md py-1 outline-none transition-colors focus-visible:ring-2 motion-reduce:transition-none"
        >
          <ChevronIcon
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-300 motion-reduce:transition-none",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
          {label}
          <span className="bg-border/80 h-px flex-1" aria-hidden />
          <span className="font-mono text-xs tracking-normal normal-case">{count}</span>
        </button>
      </h2>

      <div
        id={contentId}
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="grid grid-cols-1 items-stretch gap-4 pt-4 lg:grid-cols-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletPanel() {
  const { address, isConnected, isOnExpectedChain } = useWalletAccount();
  const { connectors, connect, status: connectStatus } = useConnectWallet();
  const { disconnect } = useDisconnectWallet();
  const { switchChain, status: switchStatus } = useSwitchToSymmioChain();

  const tone = !isConnected ? "neutral" : isOnExpectedChain ? "positive" : "warning";

  return (
    <Card data-testid="wallet-panel" size="sm" className="animate-enter-up overflow-hidden">
      <div className="flex flex-col gap-4 px-4 py-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-muted text-muted-foreground ring-border flex size-10 items-center justify-center rounded-xl ring-1">
            <WalletIcon />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <StatusDot tone={tone} pulse={isConnected && isOnExpectedChain} />
              Wallet
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span data-testid="wallet-address" className="text-foreground text-sm font-medium">
                {address ? <AddressTag address={address} /> : "Not connected"}
              </span>
              {isConnected && isOnExpectedChain ? <Badge variant="positive">Connected</Badge> : null}
              {isConnected && !isOnExpectedChain ? <Badge variant="warning">Wrong network</Badge> : null}
            </div>
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
                {connectStatus === "pending" ? <Spinner className="size-4" /> : null}
                Connect {connector.name}
              </Button>
            ))}

          {isConnected && !isOnExpectedChain && (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => switchChain().catch(() => undefined)}
              disabled={switchStatus === "pending"}
              data-testid="switch-chain"
            >
              {switchStatus === "pending" ? <Spinner className="size-4" /> : null}
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
    </Card>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
      <path
        d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M16 12h2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M3 9h13a2 2 0 0 1 2 2v0" stroke="currentColor" strokeWidth="1.75" opacity="0.5" />
    </svg>
  );
}
