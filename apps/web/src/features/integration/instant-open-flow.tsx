"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import { formatUsd } from "@/lib/format";
import type { SolverId } from "@symmio/trading-core";
import {
  SubAccountIsolationType,
  useAccountBalanceInfo,
  useAccountBalanceOf,
  useApproveCollateral,
  useCollateralAllowance,
  useCollateralBalance,
  useDeposit,
  useDepositAndAllocate,
  useGrantDelegation,
  useInstantTradeRequiredSelectors,
  useIsDelegationActive,
  useSubAccount,
  useSymmioChainId,
  useSymmioConfig,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { shortenAddress } from "@symmio/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { maxUint256, zeroAddress, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { MagicWatchButton } from "../magic-sidebar/magic-watch-button";
import { AmountField } from "./amount-field";
import { FlowLayout } from "./flow-layout";
import type { FlowStep } from "./flow-rail";
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
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const { addresses } = config.getChainConfig(chainId);
  const collateralDecimals = addresses.collateralDecimals;
  const { sessionKeyAddress } = useSessionKey();
  const sessionKey = sessionKeyAddress ?? undefined;

  // ---- Solver: which of the chain's solvers the open targets. One per chain
  // today (HyperEVM → enigma, Base → rasa); the picker makes the target visible
  // and future-proofs multi-solver chains. Reset on chain switch. ----
  const solverIds = config.listSolverIds(chainId);
  const [solverId, setSolverId] = useState<SolverId>(() => config.getDefaultSolverId(chainId));
  useEffect(() => {
    setSolverId(config.getDefaultSolverId(chainId));
  }, [config, chainId]);
  // ---- Margin model: follows the SELECTED SUB-ACCOUNT's isolation type. ----
  // `CUSTOM` isolation trades cross-margin on the sub-account directly (funds
  // live in the ALLOCATED balance, no addMargin/VA leg); the VA isolations
  // spend the AVAILABLE balance. Isolation is fixed at creation → cache forever.
  const subAccountQuery = useSubAccount({
    account: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount), staleTime: Infinity },
  });
  const isCrossMargin = subAccountQuery.data?.isolationType === SubAccountIsolationType.CUSTOM;

  // ---- Subaccount balance: gates the Fund step. ----
  // VA isolations spend the AVAILABLE balance (`balanceOf`, feeds
  // `addMarginToNextVA`); CUSTOM isolation spends the ALLOCATED balance
  // (`balanceInfoOfPartyA.allocatedBalance`). `live` refetches on the on-chain
  // settle notification, so the balance moves after an open/close anchors
  // without a manual refresh.
  const subAccountBalance = useAccountBalanceOf({
    account: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount) && !isCrossMargin },
    live: true,
  });
  const subAccountBalanceInfo = useAccountBalanceInfo({
    account: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount) && isCrossMargin },
    live: true,
  });
  const fundingBalance = isCrossMargin ? subAccountBalanceInfo.data?.allocatedBalance : subAccountBalance.data;
  const balanceKnown = Boolean(subAccount) && fundingBalance !== undefined;
  const balanceFunded = balanceKnown && (fundingBalance ?? 0n) > 0n;

  // ---- Delegation checks (open + close + addMargin). All must be active. ----
  // The set is chain-resolved: the open leg is `sendQuote` on a v0.8.6 chain
  // and the legacy `sendQuoteWithAffiliateAndData` on v0.8.5.
  const requiredSelectors = useInstantTradeRequiredSelectors();
  const [addMarginSelector, openLegSelector, closeSelector] = requiredSelectors;
  const delegationEnabled = Boolean(subAccount && sessionKey);
  const addMarginDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: sessionKey ?? zeroAddress,
    selector: addMarginSelector,
    query: { enabled: delegationEnabled },
  });
  const sendQuoteDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: sessionKey ?? zeroAddress,
    selector: openLegSelector,
    query: { enabled: delegationEnabled },
  });
  const closePositionDelegation = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: sessionKey ?? zeroAddress,
    selector: closeSelector,
    query: { enabled: delegationEnabled },
  });
  const grantDelegation = useGrantDelegation();
  // Cross-margin (CUSTOM isolation) has no addMargin leg — its gate skips that selector.
  const allDelegationsActive =
    sendQuoteDelegation.data === true &&
    closePositionDelegation.data === true &&
    (isCrossMargin || addMarginDelegation.data === true);
  const delegationsLoading =
    delegationEnabled &&
    (sendQuoteDelegation.isLoading ||
      closePositionDelegation.isLoading ||
      (!isCrossMargin && addMarginDelegation.isLoading));

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
      selectors: requiredSelectors,
      expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
    });
  }

  const fundHint = !subAccount
    ? "Pick a subaccount first"
    : !balanceKnown
      ? "Checking balance…"
      : balanceFunded
        ? `${isCrossMargin ? "Allocated" : "Available"} ${formatUsd(fundingBalance ?? 0n)}`
        : isCrossMargin
          ? "Deposit + allocate collateral"
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-muted-foreground min-w-0 text-xs leading-5">
          Watch this subaccount&apos;s quotes, positions, and notifications live while you trade.
        </span>
        <MagicWatchButton partyA={subAccount} />
      </div>

      {/* Solver target: which of the chain's solvers receives the open. */}
      <div
        className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border px-4 py-3 @lg/console:flex-row @lg/console:items-center @lg/console:justify-between"
        data-testid="instant-open-solver-picker"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Solver</span>
          <span className="text-muted-foreground text-xs leading-5">
            Orders, markets, and prices route to the selected solver; the margin model follows the sub-account&apos;s
            isolation type.
            {solverIds.length === 1 ? " Switch network to reach the other solver." : null}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {solverIds.map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={id === solverId ? "default" : "outline"}
              onClick={() => setSolverId(id)}
              data-testid={`instant-open-solver-${id}`}
            >
              {id}
            </Button>
          ))}
        </div>
      </div>

      <FlowLayout steps={steps} current={current} maxReachable={maxStep} onStepClick={setStep}>
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
            balanceWei={fundingBalance}
            isCrossMargin={isCrossMargin}
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
            showAddMargin={!isCrossMargin}
            loading={delegationsLoading}
            grant={grantDelegation}
            onGrant={onGrantDelegation}
          />
        ) : (
          <OpenPositionStep subAccount={subAccount!} sessionKey={sessionKey!} solverId={solverId} />
        )}
      </FlowLayout>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Fund subaccount
// ---------------------------------------------------------------------------

/**
 * Inline deposit form shown when the selected subaccount has zero balance.
 * Mirrors {@link DepositFlow}'s approve-then-deposit dance but scoped to the
 * subaccount picked upstream. VA-isolated sub-accounts fund the **available**
 * balance (plain deposit — instant open pulls it via `addMarginToNextVA`);
 * CUSTOM-isolation sub-accounts trade cross-margin and spend the **allocated**
 * balance, so their primary action is deposit-and-allocate in one transaction.
 */
function FundSubaccountStep({
  owner,
  subAccount,
  decimals,
  balanceWei,
  isCrossMargin,
}: {
  owner?: Address;
  subAccount?: Address;
  decimals: number;
  /** The model-appropriate funding balance: allocated (cross-margin) or available (VA isolations). */
  balanceWei?: bigint;
  isCrossMargin: boolean;
}) {
  const [amount, setAmount] = useState("");
  const walletBalance = useCollateralBalance({ owner });
  const allowance = useCollateralAllowance({ owner });
  const approve = useApproveCollateral();
  const deposit = useDeposit();
  const depositAndAllocate = useDepositAndAllocate();
  const fund = isCrossMargin ? depositAndAllocate : deposit;

  const parsed = parseAmount(amount, decimals);
  const needsApproval = parsed !== undefined && (allowance.data ?? 0n) < parsed;
  const busy = approve.isPending || fund.isPending;

  function resetActions() {
    approve.reset();
    deposit.reset();
    depositAndAllocate.reset();
  }

  function onPrimary() {
    if (!subAccount || parsed === undefined) return;
    if (needsApproval) {
      approve.mutate({ amount: maxUint256 });
      return;
    }
    fund.mutate({ account: subAccount, amount: parsed });
  }

  if (!subAccount) {
    return <ResultNote testId="instant-open-fund-disconnected">Pick a subaccount to fund.</ResultNote>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/70 bg-muted/20 flex flex-col gap-1 rounded-xl border p-4 text-sm">
        <span className="text-muted-foreground text-xs tracking-wide uppercase">
          {isCrossMargin ? "subaccount allocated balance" : "subaccount balance"}
        </span>
        <span className="text-foreground font-mono">{balanceWei !== undefined ? `${formatUsd(balanceWei)}` : "—"}</span>
        <span className="text-muted-foreground text-xs">
          {isCrossMargin
            ? "This sub-account trades cross-margin against its allocated balance. Deposit and allocate collateral to enable trading."
            : "Instant open pulls margin from the subaccount's available balance. Deposit collateral to enable trading."}
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
        {parsed === undefined
          ? "Enter an amount"
          : needsApproval
            ? "Approve USDC"
            : isCrossMargin
              ? "Deposit + allocate"
              : "Deposit"}
      </Button>

      <FundStatus approve={approve} deposit={fund} approved={!needsApproval && parsed !== undefined} />
    </div>
  );
}

function FundStatus({
  approve,
  deposit,
  approved,
}: {
  approve: ReturnType<typeof useApproveCollateral>;
  deposit: ReturnType<typeof useDeposit> | ReturnType<typeof useDepositAndAllocate>;
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
  showAddMargin,
  loading,
  grant,
  onGrant,
}: {
  subAccount?: Address;
  sessionKey?: Address;
  addMarginActive?: boolean;
  sendQuoteActive?: boolean;
  closePositionActive?: boolean;
  /** Cross-margin sub-accounts have no addMargin leg — the row is hidden (the grant still covers every selector). */
  showAddMargin: boolean;
  loading: boolean;
  grant: ReturnType<typeof useGrantDelegation>;
  onGrant: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/70 bg-muted/20 grid gap-3 rounded-xl border p-4 text-sm">
        <SelectorRow label="sendQuoteWithAffiliateAndData" active={sendQuoteActive} loading={loading} />
        <SelectorRow label="requestToClosePosition" active={closePositionActive} loading={loading} />
        {showAddMargin ? <SelectorRow label="addMarginToNextVA" active={addMarginActive} loading={loading} /> : null}

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
