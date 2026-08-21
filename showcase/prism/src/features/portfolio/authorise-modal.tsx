"use client";

import { Modal } from "@/components/modal";
import { MicroLabel } from "@/components/panel";
import { ReceiptRow } from "@/components/value";
import type { FundingAccount } from "@/features/accounts/account-provider";
import { DELEGATION_TTL_SECONDS, type TradingDelegation } from "@/features/wallet/use-trading-delegation";
import { formatDate, shortenAddress } from "@/lib/format";
import { GatedSubmit } from "./gated-submit";
import { SelectorList } from "./selector-list";
import { describeError, useWriteToast } from "./use-write-toast";

export interface AuthoriseModalProps {
  account: FundingAccount;
  /** The row's own delegation state — passed down so the probes run once per account. */
  delegation: TradingDelegation;
  open: boolean;
  onClose: () => void;
}

/**
 * Grant the session key the right to trade for one account.
 *
 * It is a sheet, like Deposit and Withdraw, for the same reason they are: the
 * write needs the wallet on the account's own chain, and the chain gate belongs
 * next to the explanation of what is being signed. That keeps the ledger row
 * down to one chip, and puts the one paragraph a first-time trader needs — why
 * a missing grant fails silently — where they read it once, not on every row.
 */
export function AuthoriseModal({ account, delegation, open, onClose }: AuthoriseModalProps) {
  const { deployment } = account;
  const runWrite = useWriteToast();
  const renewing = delegation.isActive;
  const validUntil = formatDate(new Date(Date.now() + DELEGATION_TTL_SECONDS * 1000));

  const onSubmit = () => {
    void runWrite(
      {
        pending: renewing ? "Renewing trading access…" : "Authorising trading…",
        success: renewing ? "Trading access renewed" : "Trading authorised",
        body: `${account.name} can trade without a wallet prompt until ${validUntil}.`,
      },
      async () => {
        await delegation.grantAsync();
        onClose();
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${deployment.label} · ${deployment.chainName}`}
      title={renewing ? "Renew trading access" : "Authorise trading"}
      footer={
        <>
          <GatedSubmit
            deployment={deployment}
            label={renewing ? "Renew access" : "Authorise"}
            onSubmit={onSubmit}
            loading={delegation.isGranting}
            disabled={!delegation.sessionKey}
            size="lg"
            className="w-full"
          />
          {delegation.grantError ? (
            <p className="text-center text-2xs text-warn">{describeError(delegation.grantError)}</p>
          ) : (
            <p className="text-center text-2xs text-fg-3">
              One wallet signature. Nothing moves — this only records who may sign.
            </p>
          )}
        </>
      }
    >
      <p className="text-base leading-relaxed text-fg-2">
        Orders from {account.name} are signed by the session key in this browser, so a trade never opens a wallet
        prompt. The contract only honours that signature once the account has delegated to the key — and it checks at
        execution time, so a missing grant fails silently, after the solver has already accepted the order.
      </p>

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="Account"
          value={
            <span className="text-sm text-fg-1">
              {account.name} <span className="tnum text-2xs text-fg-3">{shortenAddress(account.address)}</span>
            </span>
          }
        />
        <ReceiptRow
          label="Session key"
          value={<span className="tnum text-sm text-fg-1">{shortenAddress(delegation.sessionKey, 10, 8)}</span>}
        />
        <ReceiptRow label="Recorded on" value={<span className="text-sm text-fg-1">{deployment.chainName}</span>} />
        <ReceiptRow label="Valid until" value={<span className="tnum text-sm text-fg-1">{validUntil}</span>} />
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-2 p-3">
        <MicroLabel>What the key may do</MicroLabel>
        <SelectorList selectors={delegation.selectors} />
      </div>
    </Modal>
  );
}
