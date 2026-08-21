"use client";

import { Button } from "@/components/button";
import { useConnectWallet, useWalletAccount } from "@symmio/trading-react";
import { useState } from "react";
import { WalletMenu } from "./wallet-menu";

/**
 * Wallet connect, and — once connected — the wallet menu.
 *
 * Uses the SDK's wallet hooks rather than wagmi's directly, so connection
 * errors arrive already normalized as `SymmioRequestError`. Disconnecting
 * lives inside `WalletMenu`, behind a deliberate click, not on the chip itself.
 */
export function ConnectButton() {
  const { address, isConnected } = useWalletAccount();
  const { connectors, connect, status } = useConnectWallet();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return <WalletMenu address={address} />;
  }

  const injected = connectors[0];

  return (
    <div className="relative">
      <Button
        variant="primary"
        size="sm"
        loading={status === "pending"}
        onClick={() => {
          if (connectors.length === 1 && injected) {
            void connect(injected);
          } else {
            setOpen((value) => !value);
          }
        }}
      >
        Connect
      </Button>

      {open && connectors.length > 1 ? (
        <div className="prism-rise absolute right-0 z-40 mt-2 flex w-56 flex-col gap-1 rounded-lg border border-line bg-bg-1 p-1.5 shadow-[var(--shadow-pop)]">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              onClick={() => {
                void connect(connector);
                setOpen(false);
              }}
              className="cursor-pointer rounded-md px-3 py-2 text-left text-md text-fg-1 transition-colors duration-[var(--dur-fast)] hover:bg-bg-2 hover:text-fg-0"
            >
              {connector.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
