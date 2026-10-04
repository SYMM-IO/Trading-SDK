"use client";

import { ResultNote } from "@/components/result";
import { cn } from "@symmio/ui/lib/utils";
import { useState } from "react";
import type { Address } from "viem";
import { SetupColdStart } from "./setup-cold-start";
import { SubaccountStep } from "./subaccount-step";

/** How the wizard gets hold of a sub-account. */
type AccountRoute = "wallet" | "cold-start";

interface Props {
  owner?: Address;
  selected?: Address;
  onSelect: (account: Address) => void;
  /** The connected chain carries a relayer, so the cold-start route exists at all. */
  relayerAvailable: boolean;
  /** The wallet's native balance. `0n` means it cannot send a transaction of its own. */
  nativeBalance?: bigint;
  /** Whether this wallet already owns at least one sub-account. */
  hasAccounts: boolean;
  /** Called once a cold-start settlement lands, so the list can be re-read. */
  onSettled: () => void;
}

/**
 * Where a sub-account comes from — the one step with two genuinely different
 * routes.
 *
 * `createSubAccounts` is an ordinary transaction, so it needs native gas; the
 * cold-start settlement is executed by the relayer and paid for out of the
 * deposit, so it does not. A wallet holding no native token can only take the
 * second route, and the step says so rather than offering a button that can
 * only revert. The route is a recommendation until the user overrides it, and
 * the override then sticks.
 */
export function SetupAccountStep({
  owner,
  selected,
  onSelect,
  relayerAvailable,
  nativeBalance,
  hasAccounts,
  onSettled,
}: Props) {
  const [chosen, setChosen] = useState<AccountRoute>();

  /** Only meaningful once the balance has actually been read. */
  const cannotPayGas = nativeBalance !== undefined && nativeBalance === 0n;
  const recommended: AccountRoute = relayerAvailable && cannotPayGas && !hasAccounts ? "cold-start" : "wallet";
  const route = chosen ?? recommended;

  if (!owner) {
    return <ResultNote testId="setup-account-disconnected">Connect a wallet to load your sub-accounts.</ResultNote>;
  }

  return (
    <div className="flex flex-col gap-4">
      {relayerAvailable ? (
        <div className="border-border/70 bg-muted/20 grid gap-2 rounded-xl border p-1.5 @xl/console:grid-cols-2">
          <RouteOption
            active={route === "wallet"}
            onClick={() => setChosen("wallet")}
            title="From my wallet"
            detail="Pick an existing sub-account, or create one. Creating costs native gas."
            testId="setup-account-route-wallet"
          />
          <RouteOption
            active={route === "cold-start"}
            onClick={() => setChosen("cold-start")}
            title="Cold start"
            detail="Send USDC to a deposit address; the relayer creates and funds the account. No gas."
            testId="setup-account-route-cold-start"
          />
        </div>
      ) : null}

      {cannotPayGas && route === "wallet" ? (
        <ResultNote testId="setup-account-no-gas">
          This wallet holds no native token, so it cannot send a transaction — creating a sub-account here will fail.
          {relayerAvailable
            ? " Use the cold-start route instead: the relayer creates and funds the account for you."
            : " Fund it with native gas first, or switch to a chain that has a relayer."}
        </ResultNote>
      ) : null}

      {route === "cold-start" && relayerAvailable ? (
        <SetupColdStart owner={owner} onSettled={onSettled} />
      ) : (
        <SubaccountStep owner={owner} selected={selected} onSelect={onSelect} />
      )}
    </div>
  );
}

/** One of the account step's two routes, rendered as a segmented card. */
function RouteOption({
  active,
  onClick,
  title,
  detail,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "focus-visible:ring-ring/40 flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
        active ? "bg-background ring-border shadow-sm ring-1" : "hover:bg-muted/50",
      )}
    >
      <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{title}</span>
      <span className="text-muted-foreground text-xs leading-5">{detail}</span>
    </button>
  );
}
