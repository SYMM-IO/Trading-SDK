"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import { formatUsd } from "@/lib/format";
import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  INSTANT_TRADE_REQUIRED_SELECTORS,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
  useAccountBalanceOf,
  useApproveCollateral,
  useCollateralAllowance,
  useCollateralBalance,
  useDeposit,
  useGrantDelegation,
  useIsDelegationActive,
  useSymmioConfig,
} from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { shortenAddress } from "@symm-frontier/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { maxUint256, zeroAddress, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { AmountField } from "./amount-field";
import { FlowRail, type FlowStep } from "./flow-rail";
import { OpenPositionStep } from "./open-position-step";
import { parseAmount } from "./parse-amount";
import { SubaccountStep } from "./subaccount-step";

interface Props {
  owner?: Address;
  subAccount?: Address;
  subAccountName?: string;
  onSelectSubAccount: (account: Address) => void;
  /** Connected and on the expected chain. */
  ready: boolean;
}

/** One-year delegation expiry, expressed in unix seconds. */
const DELEGATION_TTL_SECONDS = 365 * 24 * 60 * 60;

/**
 * Instant Open wizard: Connect → Select subaccount → Session key → Delegation →
 * Open position. Each step is navigable via the rail; data loads in the step
 * that needs it.
 */
export function InstantOpenFlow({ owner, subAccount, subAccountName, onSelectSubAccount, ready }: Props) {
  const { addresses } = useSymmioConfig().getChainConfig();
  const collateralDecimals = addresses.collateralDecimals;
  const { sessionKeyAddress } = useSessionKey();
  const sessionKey = sessionKeyAddress ?? undefined;

  // ---- Subaccount balance: gates the Fund step. Available balance > 0 means
  // the subaccount can fund `addMarginToNextVA` for a trade. ----
  const subAccountBalance = useAccountBalanceOf({
    account: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount) },
  });
  const balanceKnown = Boolean(subAccount) && subAccountBalance.data !== undefined;
  const balanceFunded = balanceKnown && (subAccountBalance.data ?? 0n) > 0n;

  // ---- Delegation checks (open + close + addMargin). All must be active. ----
  const delegationEnabled = Boolean(subAccount && sessionKey);
  const addMarginDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: sessionKey ?? zeroAddress,
    selector: ADD_MARGIN_TO_NEXT_VA_SELECTOR,
    query: { enabled: delegationEnabled },
  });
  const sendQuoteDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: sessionKey ?? zeroAddress,
    selector: SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR,
    query: { enabled: delegationEnabled },
  });
  const closePositionDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: sessionKey ?? zeroAddress,
    selector: REQUEST_TO_CLOSE_POSITION_SELECTOR,
    query: { enabled: delegationEnabled },
  });
  const grantDelegation = useGrantDelegation();
  const allDelegationsActive =
    addMarginDelegation.data === true && sendQuoteDelegation.data === true && closePositionDelegation.data === true;
  const delegationsLoading =
    delegationEnabled &&
    (addMarginDelegation.isLoading || sendQuoteDelegation.isLoading || closePositionDelegation.isLoading);

  // ---- Step gating ----
  // 0: connect → 1: subaccount → 2: fund → 3: session key → 4: delegation → 5: open.
  // Fund step is gated by balance > 0; balance loading keeps `maxStep` at 2 so
  // the user sees the spinner instead of being bounced past the gate.
  const maxStep = !ready ? 0 : !subAccount ? 1 : !balanceFunded ? 2 : !sessionKey ? 3 : !allDelegationsActive ? 4 : 5;

  const [step, setStep] = useState(0);
  const current = Math.min(step, maxStep);

  useEffect(() => {
    setStep((previous) => Math.max(previous, maxStep));
  }, [maxStep]);

  function onGrantDelegation() {
    if (!subAccount || !sessionKey) return;
    grantDelegation.mutate({
      account: { addr: subAccount, isPartyB: false },
      delegatedSigner: sessionKey,
      selectors: INSTANT_TRADE_REQUIRED_SELECTORS,
      expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
    });
  }

  const fundHint = !subAccount
    ? "Pick a subaccount first"
    : !balanceKnown
      ? "Checking balance…"
      : balanceFunded
        ? `Available ${formatUsd(subAccountBalance.data ?? 0n)}`
        : "Deposit collateral";

  const steps: FlowStep[] = [
    { label: "Connect wallet", hint: ready && owner ? shortenAddress(owner) : "Connect your wallet", done: ready },
    {
      label: "Select subaccount",
      hint: subAccount ? (subAccountName ?? shortenAddress(subAccount)) : "Choose where to trade",
      done: Boolean(subAccount),
    },
    { label: "Fund subaccount", hint: fundHint, done: balanceFunded },
    {
      label: "Session key",
      hint: sessionKey ? shortenAddress(sessionKey) : "Initialize a session key",
      done: Boolean(sessionKey),
    },
    {
      label: "Delegation",
      hint: allDelegationsActive ? "Granted" : delegationsLoading ? "Checking…" : "Grant session-key access",
      done: allDelegationsActive,
    },
    {
      label: "Open position",
      hint: "Configure and submit",
      done: false,
    },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
      <div className="flex min-h-60 flex-col gap-5">
        {current === 0 ? (
          <WalletPanel />
        ) : current === 1 ? (
          <SubaccountStep
            owner={owner}
            selected={subAccount}
            onSelect={(account) => {
              onSelectSubAccount(account);
              setStep(2);
            }}
          />
        ) : current === 2 ? (
          <FundSubaccountStep
            owner={owner}
            subAccount={subAccount}
            decimals={collateralDecimals}
            balance={subAccountBalance}
          />
        ) : current === 3 ? (
          <SessionKeyStep address={sessionKey} owner={owner} />
        ) : current === 4 ? (
          <DelegationStep
            subAccount={subAccount}
            sessionKey={sessionKey}
            addMarginActive={addMarginDelegation.data}
            sendQuoteActive={sendQuoteDelegation.data}
            closePositionActive={closePositionDelegation.data}
            loading={delegationsLoading}
            grant={grantDelegation}
            onGrant={onGrantDelegation}
          />
        ) : (
          <OpenPositionStep subAccount={subAccount!} sessionKey={sessionKey!} />
        )}
      </div>

      <div className="lg:border-border/50 lg:border-l lg:pl-8">
        <FlowRail steps={steps} current={current} maxReachable={maxStep} onStepClick={setStep} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Fund subaccount
// ---------------------------------------------------------------------------

/**
 * Inline deposit form shown when the selected subaccount has zero balance.
 * Mirrors {@link DepositFlow}'s approve-then-deposit dance but scoped to the
 * subaccount picked upstream, and skips the allocate switch since instant-open
 * pulls margin from the subaccount's available balance.
 */
function FundSubaccountStep({
  owner,
  subAccount,
  decimals,
  balance,
}: {
  owner?: Address;
  subAccount?: Address;
  decimals: number;
  balance: ReturnType<typeof useAccountBalanceOf>;
}) {
  const [amount, setAmount] = useState("");
  const walletBalance = useCollateralBalance({ owner });
  const allowance = useCollateralAllowance({ owner });
  const approve = useApproveCollateral();
  const deposit = useDeposit();

  const parsed = parseAmount(amount, decimals);
  const needsApproval = parsed !== undefined && (allowance.data ?? 0n) < parsed;
  const busy = approve.isPending || deposit.isPending;

  function resetActions() {
    approve.reset();
    deposit.reset();
  }

  function onPrimary() {
    if (!subAccount || parsed === undefined) return;
    if (needsApproval) {
      approve.mutate({ amount: maxUint256 });
      return;
    }
    deposit.mutate({ account: subAccount, amount: parsed });
  }

  if (!subAccount) {
    return <ResultNote testId="instant-open-fund-disconnected">Pick a subaccount to fund.</ResultNote>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/70 bg-muted/20 flex flex-col gap-1 rounded-xl border p-4 text-sm">
        <span className="text-muted-foreground text-xs tracking-wide uppercase">subaccount balance</span>
        <span className="text-foreground font-mono">
          {balance.data !== undefined ? `${formatUsd(balance.data)}` : "—"}
        </span>
        <span className="text-muted-foreground text-xs">
          Instant open pulls margin from the subaccount&apos;s available balance. Deposit collateral to enable trading.
        </span>
      </div>

      <AmountField
        id="instant-open-fund-amount"
        testId="instant-open-fund-amount"
        label="Amount to deposit"
        value={amount}
        onChange={(next) => {
          setAmount(next);
          resetActions();
        }}
        decimals={decimals}
        max={walletBalance.data}
        maxLabel="in wallet"
        invalid={amount.length > 0 && parsed === undefined}
      />

      <Button
        type="button"
        size="lg"
        disabled={parsed === undefined || busy}
        onClick={onPrimary}
        data-testid="instant-open-fund-primary"
        className="w-full"
      >
        {busy ? <Spinner className="size-4" /> : null}
        {parsed === undefined ? "Enter an amount" : needsApproval ? "Approve USDC" : "Deposit"}
      </Button>

      <FundStatus approve={approve} deposit={deposit} approved={!needsApproval && parsed !== undefined} />
    </div>
  );
}

function FundStatus({
  approve,
  deposit,
  approved,
}: {
  approve: ReturnType<typeof useApproveCollateral>;
  deposit: ReturnType<typeof useDeposit>;
  approved: boolean;
}) {
  if (approve.isPending) {
    return (
      <ResultNote testId="instant-open-fund-status" loading>
        Approving USDC… confirm in your wallet.
      </ResultNote>
    );
  }
  if (approve.error) {
    return <ResultError testId="instant-open-fund-status" kind={approve.error.kind} message={approve.error.message} />;
  }
  if (deposit.isPending) {
    return (
      <ResultNote testId="instant-open-fund-status" loading>
        Submitting deposit… confirm in your wallet, then waiting for the receipt.
      </ResultNote>
    );
  }
  if (deposit.error) {
    return <ResultError testId="instant-open-fund-status" kind={deposit.error.kind} message={deposit.error.message} />;
  }
  if (deposit.isSuccess) {
    return (
      <ResultSuccess testId="instant-open-fund-status">
        <span className="text-foreground">Deposit confirmed.</span>
        <TxReceipt
          hash={deposit.data.hash}
          receipt={
            deposit.data.receipt
              ? { blockNumber: deposit.data.receipt.blockNumber, status: String(deposit.data.receipt.status) }
              : undefined
          }
        />
      </ResultSuccess>
    );
  }
  if (approve.isSuccess && approved) {
    return <ResultNote testId="instant-open-fund-status">Approved — you can deposit now.</ResultNote>;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step 3 — Session key
// ---------------------------------------------------------------------------

function SessionKeyStep({ address, owner }: { address?: Address; owner?: Address }) {
  if (address) {
    return (
      <div className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Session key</span>
          <Badge variant="positive">Ready</Badge>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">address</span>
          <span className="text-foreground font-mono" data-testid="instant-open-session-key-address">
            {address}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
      <span className="text-muted-foreground text-sm">
        {owner
          ? "No session key for the connected wallet. Initialize one to sign instant-open operations without prompting the wallet."
          : "Connect a wallet to initialize a session key."}
      </span>
      <Button asChild size="sm" disabled={!owner}>
        <Link href="/session-keys" data-testid="instant-open-init-session-key">
          Go to Session Keys
        </Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Delegation
// ---------------------------------------------------------------------------

function DelegationStep({
  subAccount,
  sessionKey,
  addMarginActive,
  sendQuoteActive,
  closePositionActive,
  loading,
  grant,
  onGrant,
}: {
  subAccount?: Address;
  sessionKey?: Address;
  addMarginActive?: boolean;
  sendQuoteActive?: boolean;
  closePositionActive?: boolean;
  loading: boolean;
  grant: ReturnType<typeof useGrantDelegation>;
  onGrant: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/70 bg-muted/20 grid gap-3 rounded-xl border p-4 text-sm">
        <SelectorRow label="sendQuoteWithAffiliateAndData" active={sendQuoteActive} loading={loading} />
        <SelectorRow label="requestToClosePosition" active={closePositionActive} loading={loading} />
        <SelectorRow label="addMarginToNextVA" active={addMarginActive} loading={loading} />

        <div className="border-border/60 flex flex-col gap-1 border-t pt-3">
          <span className="text-muted-foreground text-xs">subaccount</span>
          <span className="text-foreground font-mono">{subAccount ? shortenAddress(subAccount) : "—"}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">delegate</span>
          <span className="text-foreground font-mono">{sessionKey ? shortenAddress(sessionKey) : "—"}</span>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        onClick={onGrant}
        disabled={!subAccount || !sessionKey || grant.isPending}
        data-testid="instant-open-grant-delegation"
        className="w-full"
      >
        {grant.isPending ? <Spinner className="size-4" /> : null}
        {grant.isPending ? "Granting delegation…" : "Grant delegation for 1 year"}
      </Button>

      {grant.error ? (
        <ResultError testId="instant-open-grant-error" kind={grant.error.kind} message={grant.error.message} />
      ) : null}
      {grant.isSuccess ? (
        <ResultSuccess testId="instant-open-grant-success">
          <span className="text-foreground">Delegation granted.</span>
          <TxReceipt
            hash={grant.data.hash}
            receipt={
              grant.data.receipt
                ? { blockNumber: grant.data.receipt.blockNumber, status: String(grant.data.receipt.status) }
                : undefined
            }
          />
        </ResultSuccess>
      ) : null}
    </div>
  );
}

function SelectorRow({ label, active, loading }: { label: string; active?: boolean; loading: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground font-mono text-xs">{label}</span>
      {loading ? (
        <Badge variant="secondary">Checking…</Badge>
      ) : active === true ? (
        <Badge variant="positive">Active</Badge>
      ) : active === false ? (
        <Badge variant="warning">Missing</Badge>
      ) : (
        <Badge variant="secondary">—</Badge>
      )}
    </div>
  );
}
