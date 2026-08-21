"use client";

import { DEPLOYMENTS, FAMILY_PALETTE, getDeploymentByChainId } from "@/config/deployments";
import { AccountAddress } from "@/features/portfolio/account-address";
import { cn } from "@/lib/cn";
import { shortenAddress } from "@/lib/format";
import { useDisconnectWallet, useWalletAccount } from "@symmio/trading-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Address } from "viem";
import { useChains, useConnection, useSwitchChain } from "wagmi";
import { WalletAvatar } from "./wallet-avatar";

interface Props {
  address: Address;
}

const ITEM_SELECTOR =
  '[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemradio"]:not([aria-disabled="true"])';

const ROW =
  "flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-fg-1 transition-colors duration-[var(--dur-fast)] hover:bg-bg-2 hover:text-fg-0 focus-visible:bg-bg-2 focus-visible:text-fg-0 focus-visible:outline-none aria-disabled:cursor-default aria-disabled:opacity-50";

/**
 * The connected wallet's control: a chip that opens a menu.
 *
 * Disconnect used to be the chip's *click* — one accidental tap in the corner
 * and the session was gone, with nothing else the address could do. The menu
 * gives the wallet a home: copy the address, see which network the wallet is
 * on and move it (this is a two-chain app, and every deposit or withdrawal is
 * gated on the right one), jump to the portfolio or the explorer, and only
 * then, at the bottom, disconnect.
 *
 * Keyboard: arrows move between items, Home/End jump, Escape closes and returns
 * focus to the chip. An outside click closes it; the menu traps nothing.
 */
export function WalletMenu({ address }: Props) {
  const { chainId } = useWalletAccount();
  const { connector } = useConnection();
  const chains = useChains();
  const {
    mutate: switchChain,
    status: switchStatus,
    variables: switching,
    error: switchError,
    reset,
  } = useSwitchChain();
  const { disconnect, status: disconnectStatus } = useDisconnectWallet();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const home = chainId === undefined ? undefined : getDeploymentByChainId(chainId);
  const explorer = chains.find((chain) => chain.id === chainId)?.blockExplorers?.default;

  /* Outside click and Escape are document-level: focus may be on the copy
     button, a row, or nowhere at all when either happens. */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function items(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      window.requestAnimationFrame(() => {
        const list = items();
        (event.key === "ArrowDown" ? list[0] : list[list.length - 1])?.focus();
      });
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        list[(index + 1) % list.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        list[(index - 1 + list.length) % list.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        list[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        list[list.length - 1]?.focus();
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "group flex h-7 cursor-pointer items-center gap-2 rounded-md border border-line bg-bg-2 pr-2 pl-1.5",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-line-strong",
          "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
          open && "border-line-strong bg-bg-3",
        )}
      >
        <WalletAvatar address={address} size={16} />
        <span className="tnum text-sm text-fg-1 transition-colors duration-[var(--dur-fast)] group-hover:text-fg-0">
          {shortenAddress(address, 6, 4)}
        </span>
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: home ? `var(${home.chainColorVar})` : "var(--warn-500)" }}
        />
        <span className="sr-only">{home ? `on ${home.chainName}` : "on an unsupported network"}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Wallet"
          onKeyDown={onMenuKeyDown}
          className="prism-rise absolute top-[calc(100%+8px)] right-0 z-40 w-[272px] rounded-lg border border-line bg-bg-1 p-1.5 shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
            <WalletAvatar address={address} size={32} />
            <div className="min-w-0 flex-1">
              <AccountAddress address={address} lead={8} tail={6} size="sm" />
              <p className="mt-0.5 truncate text-2xs text-fg-3">
                {connector?.name ?? "Wallet"}
                <span className="mx-1.5 opacity-60">·</span>
                {home ? home.chainName : <span className="text-warn">Unsupported network</span>}
              </p>
            </div>
          </div>

          <Divider />

          <p className="px-2.5 pt-1.5 pb-1 text-2xs font-semibold tracking-[var(--tracking-mega)] text-fg-3 uppercase">
            Network
          </p>
          {DEPLOYMENTS.map((deployment) => {
            const target = chains.find((chain) => chain.id === deployment.chainId);
            const current = deployment.chainId === chainId;
            const pending = switchStatus === "pending" && switching?.chainId === deployment.chainId;
            return (
              <button
                key={deployment.family}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                aria-disabled={pending || !target}
                onClick={() => {
                  if (current || pending || !target) return;
                  switchChain({ chainId: target.id });
                }}
                className={cn(ROW, current && "text-fg-0")}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: `var(${deployment.chainColorVar})` }}
                />
                <span className="flex-1">{deployment.chainName}</span>
                <span className="text-2xs" style={{ color: FAMILY_PALETTE[deployment.family].base }}>
                  {deployment.label}
                </span>
                <span className="flex w-3.5 justify-end">{current ? <Check /> : pending ? <Spinner /> : null}</span>
              </button>
            );
          })}
          {switchError ? (
            <p className="px-2.5 pt-1 pb-1.5 text-2xs leading-snug text-warn">
              The wallet declined the network switch.
            </p>
          ) : null}

          <Divider />

          <Link href="/portfolio" role="menuitem" onClick={() => setOpen(false)} className={ROW}>
            <PortfolioIcon />
            <span className="flex-1">Portfolio</span>
          </Link>
          {explorer ? (
            <a
              href={`${explorer.url}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={ROW}
            >
              <ExternalIcon />
              <span className="flex-1">View on {explorer.name}</span>
            </a>
          ) : null}

          <Divider />

          <button
            type="button"
            role="menuitem"
            aria-disabled={disconnectStatus === "pending"}
            onClick={() => {
              if (disconnectStatus === "pending") return;
              void disconnect();
            }}
            className={cn(ROW, "hover:bg-short-bg hover:text-short focus-visible:bg-short-bg focus-visible:text-short")}
          >
            <PowerIcon />
            <span className="flex-1">Disconnect</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Divider() {
  return <hr className="my-1 border-0 border-t border-line-subtle" />;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="none"
      aria-hidden
      className={cn(
        "shrink-0 text-fg-3 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] group-hover:text-fg-1",
        open && "rotate-180",
      )}
    >
      <path
        d="M2 3.5 5 6.5 8 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden className="text-long">
      <path
        d="M2.5 6.4l2.4 2.4 4.6-5.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="block size-3 rounded-full border-[1.5px] border-current border-t-transparent text-fg-3"
      style={{ animation: "prism-spin 700ms linear infinite" }}
    />
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" aria-hidden className="shrink-0 text-fg-3">
      {children}
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <Icon>
      <rect x="1.5" y="2.5" width="11" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6h11" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 8.6h1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </Icon>
  );
}

function ExternalIcon() {
  return (
    <Icon>
      <path
        d="M6 2.5H3.3A1.8 1.8 0 0 0 1.5 4.3v6.4a1.8 1.8 0 0 0 1.8 1.8h6.4a1.8 1.8 0 0 0 1.8-1.8V8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M8.5 1.5h4v4M12.3 1.7 7 7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

function PowerIcon() {
  return (
    <Icon>
      <path d="M7 1.5v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.2 3.6a4.6 4.6 0 1 0 5.6 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </Icon>
  );
}
