"use client";

import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import {
  INSTANT_TRADE_REQUIRED_SELECTORS,
  PositionType,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SymmioRequestError,
  useDeleteQuoteTpSl,
  useEnigmaPriceByMarketId,
  useGrantDelegation,
  useIsDelegationActive,
  useMarkets,
  usePartyAOpenPositions,
  useQuoteTpSl,
  useSetQuoteTpSl,
  useSymmioConfig,
  useTpSlConfig,
  useVirtualAccount,
  useVirtualAccountsAddressesOfSubAccount,
  validateTpSl,
  type TpSlInfoState,
  type TpSlPriceType,
  type TpSlValidation,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { shortenAddress } from "@symmio/utils";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { WalletPanel } from "../inspector/wallet-panel";
import { FlowRail, type FlowStep } from "./flow-rail";
import { SubaccountStep } from "./subaccount-step";

const WEI_DECIMALS = 18;
const DELEGATION_TTL_SECONDS = 365 * 24 * 60 * 60;

interface Props {
  owner?: Address;
  subAccount?: Address;
  subAccountName?: string;
  onSelectSubAccount: (account: Address) => void;
  ready: boolean;
}

/**
 * TP/SL wizard: Connect → Subaccount → VA → Session key → Delegation (to COH
 * wallet) → Pick position → Set TP/SL form. Reads + writes the handler-side
 * conditional orders with a live config-driven validation overlay.
 */
export function TpSlFlow({ owner, subAccount, subAccountName, onSelectSubAccount, ready }: Props) {
  const { sessionKeyAddress } = useSessionKey();
  const sessionKey = sessionKeyAddress ?? undefined;

  const config = useSymmioConfig();
  const chainConfig = config.getChainConfig();
  const cohWalletAddress = chainConfig.solver.tpsl?.cohWalletAddress;

  const [virtualAccount, setVirtualAccount] = useState<Address>();
  const [selectedQuoteId, setSelectedQuoteId] = useState<bigint>();
  useEffect(() => {
    setVirtualAccount(undefined);
    setSelectedQuoteId(undefined);
  }, [subAccount]);
  useEffect(() => {
    setSelectedQuoteId(undefined);
  }, [virtualAccount]);

  // Delegation is granted to the COH wallet, not the session key — the handler
  // executes `requestToClosePosition` on the user's behalf when a trigger
  // fires, so the COH wallet needs the same selectors as instant trade.
  const delegationEnabled = Boolean(subAccount && cohWalletAddress);
  const delegationCheck = useIsDelegationActive({
    account: subAccount ?? zeroAddress,
    delegate: cohWalletAddress ?? zeroAddress,
    selector: REQUEST_TO_CLOSE_POSITION_SELECTOR,
    query: { enabled: delegationEnabled },
  });
  const grant = useGrantDelegation();
  const delegationActive = delegationCheck.data === true;
  const delegationLoading = delegationEnabled && delegationCheck.isLoading;

  const positionsQuery = usePartyAOpenPositions({
    partyA: virtualAccount,
    start: 0n,
    size: 200n,
    query: { enabled: Boolean(virtualAccount) },
  });
  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);
  const selectedPosition = useMemo(() => positions.find((p) => p.id === selectedQuoteId), [positions, selectedQuoteId]);

  const maxStep = !ready
    ? 0
    : !subAccount
      ? 1
      : !virtualAccount
        ? 2
        : !sessionKey
          ? 3
          : !delegationActive
            ? 4
            : !selectedPosition
              ? 5
              : 6;
  const [step, setStep] = useState(0);
  const current = Math.min(step, maxStep);
  useEffect(() => {
    setStep((p) => Math.max(p, maxStep));
  }, [maxStep]);

  function onGrant() {
    if (!subAccount || !cohWalletAddress) return;
    grant.mutate({
      account: { addr: subAccount, isPartyB: false },
      delegatedSigner: cohWalletAddress,
      selectors: INSTANT_TRADE_REQUIRED_SELECTORS,
      expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + DELEGATION_TTL_SECONDS),
    });
  }

  const steps: FlowStep[] = [
    { label: "Connect wallet", hint: ready && owner ? shortenAddress(owner) : "Connect your wallet", done: ready },
    {
      label: "Select subaccount",
      hint: subAccount ? (subAccountName ?? shortenAddress(subAccount)) : "Choose where to trade",
      done: Boolean(subAccount),
    },
    {
      label: "Virtual account",
      hint: virtualAccount ? shortenAddress(virtualAccount) : "Pick a VA",
      done: Boolean(virtualAccount),
    },
    {
      label: "Session key",
      hint: sessionKey ? shortenAddress(sessionKey) : "Initialize a session key",
      done: Boolean(sessionKey),
    },
    {
      label: "Delegation",
      hint: delegationActive
        ? "Granted to COH wallet"
        : delegationLoading
          ? "Checking…"
          : cohWalletAddress
            ? `Grant ${shortenAddress(cohWalletAddress)}`
            : "TP/SL not configured",
      done: delegationActive,
    },
    {
      label: "Pick position",
      hint: selectedPosition ? `Quote #${selectedPosition.id.toString()}` : "Choose a position",
      done: Boolean(selectedPosition),
    },
    { label: "Set TP/SL", hint: "Configure and submit", done: false },
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
          <VirtualAccountStep
            subAccount={subAccount}
            selected={virtualAccount}
            onSelect={(va) => {
              setVirtualAccount(va);
              setStep(3);
            }}
          />
        ) : current === 3 ? (
          <SessionKeyPrompt address={sessionKey} owner={owner} />
        ) : current === 4 ? (
          <DelegationPrompt
            subAccount={subAccount}
            cohWallet={cohWalletAddress}
            active={delegationActive}
            loading={delegationLoading}
            isRefetching={delegationCheck.isRefetching}
            onRefetch={() => void delegationCheck.refetch()}
            grant={grant}
            onGrant={onGrant}
          />
        ) : current === 5 ? (
          <PositionPickerStep
            virtualAccount={virtualAccount}
            positions={positions.map((q) => ({
              id: q.id,
              symbolId: q.symbolId,
              positionType: q.positionType,
              quantity: q.quantity,
              closedAmount: q.closedAmount,
            }))}
            isLoading={positionsQuery.isLoading}
            isRefetching={positionsQuery.isRefetching}
            error={positionsQuery.error}
            onRefetch={() => void positionsQuery.refetch()}
            selected={selectedQuoteId}
            onSelect={(id) => {
              setSelectedQuoteId(id);
              setStep(6);
            }}
          />
        ) : (
          <SetTpSlStep
            subAccount={subAccount!}
            virtualAccount={virtualAccount!}
            sessionKey={sessionKey!}
            position={{
              id: selectedPosition!.id,
              symbolId: selectedPosition!.symbolId,
              positionType: selectedPosition!.positionType,
              quantity: selectedPosition!.quantity,
              closedAmount: selectedPosition!.closedAmount,
              openedPrice: selectedPosition!.openedPrice,
            }}
          />
        )}
      </div>
      <div className="lg:border-border/50 lg:border-l lg:pl-8">
        <FlowRail steps={steps} current={current} maxReachable={maxStep} onStepClick={setStep} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Virtual account
// ---------------------------------------------------------------------------

function VirtualAccountStep({
  subAccount,
  selected,
  onSelect,
}: {
  subAccount?: Address;
  selected?: Address;
  onSelect: (va: Address) => void;
}) {
  const query = useVirtualAccountsAddressesOfSubAccount({
    subAccount: subAccount ?? zeroAddress,
    query: { enabled: Boolean(subAccount) },
  });
  if (!subAccount) return <ResultNote testId="tpsl-va-disconnected">Pick a subaccount first.</ResultNote>;
  if (query.isLoading) {
    return (
      <ResultNote testId="tpsl-va-loading" loading>
        Loading virtual accounts…
      </ResultNote>
    );
  }
  if (query.error) {
    return <ResultError testId="tpsl-va-error" kind={query.error.kind} message={query.error.message} />;
  }
  const items = query.data ?? [];
  if (items.length === 0) {
    return <ResultNote testId="tpsl-va-empty">No virtual accounts yet for this subaccount.</ResultNote>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="tpsl-va-list">
      {items.map((va) => (
        <VirtualAccountOption key={va} address={va} active={va === selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

function VirtualAccountOption({
  address,
  active,
  onSelect,
}: {
  address: Address;
  active: boolean;
  onSelect: (va: Address) => void;
}) {
  const detail = useVirtualAccount({ account: address });
  return (
    <button
      type="button"
      onClick={() => onSelect(address)}
      data-testid={`tpsl-va-${address}`}
      className={cn(
        "focus-visible:ring-ring/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
        active
          ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
          : "border-border/70 hover:border-border hover:bg-muted/40",
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground font-mono text-xs">{shortenAddress(address)}</span>
        <span className="text-muted-foreground text-[0.7rem] leading-tight">
          {detail.data ? `symbol ${detail.data.symbolId.toString()}` : "Loading…"}
        </span>
      </span>
      {active ? <Badge variant="positive">Selected</Badge> : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Session key prompt
// ---------------------------------------------------------------------------

function SessionKeyPrompt({ address, owner }: { address?: Address; owner?: Address }) {
  if (address) {
    return (
      <div className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
        <Badge variant="positive">Session key ready</Badge>
        <span className="text-foreground font-mono text-sm" data-testid="tpsl-session-key-address">
          {address}
        </span>
      </div>
    );
  }
  return (
    <div className="border-border/70 bg-muted/20 flex flex-col gap-3 rounded-xl border p-4">
      <span className="text-muted-foreground text-sm">
        {owner ? "No session key. Initialize one to sign TP/SL operations." : "Connect a wallet first."}
      </span>
      <Button asChild size="sm" disabled={!owner}>
        <Link href="/session-keys">Go to Session Keys</Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delegation prompt — to COH wallet
// ---------------------------------------------------------------------------

function DelegationPrompt({
  subAccount,
  cohWallet,
  active,
  loading,
  isRefetching,
  onRefetch,
  grant,
  onGrant,
}: {
  subAccount?: Address;
  cohWallet?: Address;
  active: boolean;
  loading: boolean;
  isRefetching: boolean;
  onRefetch: () => void;
  grant: ReturnType<typeof useGrantDelegation>;
  onGrant: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/70 bg-muted/20 grid gap-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-foreground font-mono text-xs">requestToClosePosition</span>
          {loading ? (
            <Badge variant="secondary">Checking…</Badge>
          ) : active ? (
            <Badge variant="positive">Active</Badge>
          ) : (
            <Badge variant="warning">Missing</Badge>
          )}
        </div>
        <div className="border-border/60 flex flex-col gap-1 border-t pt-3">
          <span className="text-muted-foreground text-xs">subaccount</span>
          <span className="text-foreground font-mono">{subAccount ? shortenAddress(subAccount) : "—"}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">COH wallet (delegate)</span>
          <span className="text-foreground font-mono">{cohWallet ? shortenAddress(cohWallet) : "—"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="lg"
          onClick={onGrant}
          disabled={!subAccount || !cohWallet || grant.isPending}
          data-testid="tpsl-grant-delegation"
          className="flex-1"
        >
          {grant.isPending ? <Spinner className="size-4" /> : null}
          {grant.isPending ? "Granting…" : "Grant delegation"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRefetch} disabled={isRefetching}>
          {isRefetching ? <Spinner className="size-3" /> : null}
          Refresh
        </Button>
      </div>

      {grant.error ? (
        <ResultError testId="tpsl-grant-error" kind={grant.error.kind} message={grant.error.message} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Position picker
// ---------------------------------------------------------------------------

interface PickerPosition {
  id: bigint;
  symbolId: bigint;
  positionType: PositionType;
  quantity: bigint;
  closedAmount: bigint;
}

function PositionPickerStep({
  virtualAccount,
  positions,
  isLoading,
  isRefetching,
  error,
  onRefetch,
  selected,
  onSelect,
}: {
  virtualAccount?: Address;
  positions: PickerPosition[];
  isLoading: boolean;
  isRefetching: boolean;
  error: SymmioRequestError | null;
  onRefetch: () => void;
  selected?: bigint;
  onSelect: (id: bigint) => void;
}) {
  if (!virtualAccount) return <ResultNote testId="tpsl-positions-empty">Pick a VA first.</ResultNote>;
  if (isLoading) {
    return (
      <ResultNote testId="tpsl-positions-loading" loading>
        Loading positions…
      </ResultNote>
    );
  }
  if (error) {
    return <ResultError testId="tpsl-positions-error" kind={error.kind} message={error.message} />;
  }
  if (positions.length === 0) {
    return <ResultNote testId="tpsl-positions-none">No open positions for this VA.</ResultNote>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{positions.length} positions</span>
        <Button type="button" size="sm" variant="outline" onClick={onRefetch} disabled={isRefetching}>
          {isRefetching ? <Spinner className="size-3" /> : null}
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2" data-testid="tpsl-positions-list">
        {positions.map((p) => {
          const active = p.id === selected;
          const remaining = p.quantity - p.closedAmount;
          return (
            <button
              key={p.id.toString()}
              type="button"
              onClick={() => onSelect(p.id)}
              data-testid={`tpsl-position-${p.id.toString()}`}
              className={cn(
                "focus-visible:ring-ring/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
                active
                  ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
                  : "border-border/70 hover:border-border hover:bg-muted/40",
              )}
            >
              <span className="flex flex-col">
                <span className="text-foreground text-sm font-medium">
                  Quote #{p.id.toString()} · symbol {p.symbolId.toString()}
                </span>
                <span className="text-muted-foreground font-mono text-[0.7rem]">
                  remaining {formatUnits(remaining, WEI_DECIMALS)}
                </span>
              </span>
              <Badge variant={p.positionType === PositionType.LONG ? "positive" : "destructive"}>
                {p.positionType === PositionType.LONG ? "Long" : "Short"}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Set TP/SL
// ---------------------------------------------------------------------------

function SetTpSlStep({
  subAccount,
  virtualAccount,
  sessionKey,
  position,
}: {
  subAccount: Address;
  virtualAccount: Address;
  sessionKey: Address;
  position: {
    id: bigint;
    symbolId: bigint;
    positionType: PositionType;
    quantity: bigint;
    closedAmount: bigint;
    openedPrice: bigint;
  };
}) {
  const marketsQuery = useMarkets();
  const market = useMemo(
    () => marketsQuery.data?.find((m) => BigInt(m.symbol_id ?? -1) === position.symbolId),
    [marketsQuery.data, position.symbolId],
  );
  const pricePrecision = Number(market?.price_precision ?? 4);
  const remainingQty = position.quantity - position.closedAmount;
  const openedPriceDecimal = formatUnits(position.openedPrice, WEI_DECIMALS);

  const priceQuery = useEnigmaPriceByMarketId({ marketId: position.symbolId });
  const markPriceDecimal = priceQuery.markPrice ?? "";

  const current = useQuoteTpSl({ quoteId: position.id, account: subAccount });

  const tpslConfig = useTpSlConfig();
  const mutation = useSetQuoteTpSl();
  const deleteMutation = useDeleteQuoteTpSl();

  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [tpPriceType, setTpPriceType] = useState<TpSlPriceType>("markPrice");
  const [slPriceType, setSlPriceType] = useState<TpSlPriceType>("markPrice");
  const [slippage, setSlippage] = useState("90");
  const tpSeededRef = useRef(false);
  const slSeededRef = useRef(false);
  const [deletingSides, setDeletingSides] = useState<{ tp: boolean; sl: boolean }>({ tp: false, sl: false });

  // Seed each side once from the confirmed snapshot. After the initial seed
  // the user owns the field — a mid-flight refetch (rows returning the stale
  // priceType before the WS confirms) must not stomp their new selection.
  useEffect(() => {
    if (!current.data) return;
    if (!tpSeededRef.current && current.data.tp) {
      setTpPrice(current.data.tp);
      setTpPriceType(current.data.tpPriceType);
      tpSeededRef.current = true;
    }
    if (!slSeededRef.current && current.data.sl) {
      setSlPrice(current.data.sl);
      setSlPriceType(current.data.slPriceType);
      slSeededRef.current = true;
    }
  }, [current.data]);

  // After a delete is dispatched, wait for the WS `cancel` frame to drop the
  // row (snapshot side becomes empty) before clearing the input. This is what
  // "confirmed by notification" means — POST 200 alone doesn't clear.
  useEffect(() => {
    if (!current.data) return;
    if (deletingSides.tp && !current.data.tp && current.data.tpState !== "confirming") {
      setTpPrice("");
      setTpPriceType("markPrice");
      setDeletingSides((prev) => ({ ...prev, tp: false }));
    }
    if (deletingSides.sl && !current.data.sl && current.data.slState !== "confirming") {
      setSlPrice("");
      setSlPriceType("markPrice");
      setDeletingSides((prev) => ({ ...prev, sl: false }));
    }
  }, [current.data, deletingSides.tp, deletingSides.sl]);

  const validation: TpSlValidation = useMemo(() => {
    if (!tpslConfig.data) return { ok: true };
    return validateTpSl({
      takeProfitPrice: tpPrice || undefined,
      stopLossPrice: slPrice || undefined,
      openPrice: openedPriceDecimal,
      positionType: position.positionType,
      pricePrecision,
      config: tpslConfig.data,
    });
  }, [tpPrice, slPrice, tpslConfig.data, openedPriceDecimal, position.positionType, pricePrecision]);

  const slippageNumber = Number(slippage);
  const validSlippage = Number.isFinite(slippageNumber) && slippageNumber > 0;

  // Compare current inputs against the last confirmed snapshot per side.
  // A side is "dirty" only when the user actually changed something on it —
  // avoids re-submitting an untouched TP just because the user edited SL
  // (which would flip TP into `confirming` for no reason).
  const tpDirty =
    (tpPrice || "") !== (current.data?.tp || "") ||
    (Boolean(tpPrice) && tpPriceType !== (current.data?.tpPriceType ?? "markPrice"));
  const slDirty =
    (slPrice || "") !== (current.data?.sl || "") ||
    (Boolean(slPrice) && slPriceType !== (current.data?.slPriceType ?? "markPrice"));

  const submitTp = tpDirty && tpPrice.length > 0;
  const submitSl = slDirty && slPrice.length > 0;
  const hasAnyDirty = submitTp || submitSl;
  const canSubmit = hasAnyDirty && validation.ok && validSlippage && !mutation.isPending;

  async function handleSubmit() {
    if (!canSubmit) return;
    await mutation.mutateAsync({
      from: sessionKey,
      quoteId: position.id,
      virtualAccount,
      subAccount,
      symbolId: position.symbolId,
      positionType: position.positionType,
      quantity: formatUnits(remainingQty, WEI_DECIMALS),
      pricePrecision,
      slippage: slippageNumber,
      tp: submitTp ? { triggerPrice: tpPrice, priceType: tpPriceType } : undefined,
      sl: submitSl ? { triggerPrice: slPrice, priceType: slPriceType } : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/70 bg-muted/10 grid gap-2 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Position prices</div>
          <Badge variant={position.positionType === PositionType.LONG ? "positive" : "destructive"}>
            {position.positionType === PositionType.LONG ? "LONG" : "SHORT"}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Open price</dt>
          <dd className="text-foreground font-mono">{openedPriceDecimal}</dd>
          <dt className="text-muted-foreground">Mark price</dt>
          <dd className="text-foreground font-mono">
            {markPriceDecimal !== "" ? (
              markPriceDecimal
            ) : priceQuery.isLoading ? (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Spinner className="size-3" /> Loading…
              </span>
            ) : (
              "—"
            )}
          </dd>
        </dl>
        <div className="border-border/60 mt-2 flex items-center justify-between border-t pt-2">
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Current TP/SL</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={current.isFetching}
            onClick={() => void current.refetch()}
            className="h-6 px-2 text-xs"
            data-testid="tpsl-refetch"
          >
            {current.isFetching ? <Spinner className="size-3" /> : null}
            {current.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        {current.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner className="size-3" /> Loading…
          </div>
        ) : current.data ? (
          <dl className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">TP</dt>
            <dd className="text-foreground font-mono">
              {current.data.tp ? `${current.data.tp} (${current.data.tpPriceType})` : "—"}
            </dd>
            <dd className="justify-self-end">
              <TpSlSideStateBadge
                state={current.data.tpState}
                hasValue={Boolean(current.data.tp) || current.data.tpState === "confirming"}
              />
            </dd>
            <dd className="justify-self-end">
              <DeleteSideButton
                cohQuoteId={current.data.tpCohQuoteId}
                side="take_profit"
                disabled={
                  !sessionKey || !current.data.tp || current.data.tpState === "confirming" || deleteMutation.isPending
                }
                onDelete={(cohQuoteId) =>
                  deleteMutation.mutate(
                    {
                      from: sessionKey,
                      quoteId: position.id,
                      virtualAccount,
                      cohQuoteId,
                      conditionalOrderType: "take_profit",
                    },
                    {
                      onSuccess: () => setDeletingSides((prev) => ({ ...prev, tp: true })),
                    },
                  )
                }
              />
            </dd>
            <dt className="text-muted-foreground">SL</dt>
            <dd className="text-foreground font-mono">
              {current.data.sl ? `${current.data.sl} (${current.data.slPriceType})` : "—"}
            </dd>
            <dd className="justify-self-end">
              <TpSlSideStateBadge
                state={current.data.slState}
                hasValue={Boolean(current.data.sl) || current.data.slState === "confirming"}
              />
            </dd>
            <dd className="justify-self-end">
              <DeleteSideButton
                cohQuoteId={current.data.slCohQuoteId}
                side="stop_loss"
                disabled={
                  !sessionKey || !current.data.sl || current.data.slState === "confirming" || deleteMutation.isPending
                }
                onDelete={(cohQuoteId) =>
                  deleteMutation.mutate(
                    {
                      from: sessionKey,
                      quoteId: position.id,
                      virtualAccount,
                      cohQuoteId,
                      conditionalOrderType: "stop_loss",
                    },
                    {
                      onSuccess: () => setDeletingSides((prev) => ({ ...prev, sl: true })),
                    },
                  )
                }
              />
            </dd>
          </dl>
        ) : (
          <span className="text-muted-foreground text-xs">No TP/SL.</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TpSlInputCard
          label="Take Profit"
          price={tpPrice}
          onPriceChange={setTpPrice}
          priceType={tpPriceType}
          onPriceTypeChange={setTpPriceType}
          error={!validation.ok ? validation.tpError : undefined}
        />
        <TpSlInputCard
          label="Stop Loss"
          price={slPrice}
          onPriceChange={setSlPrice}
          priceType={slPriceType}
          onPriceTypeChange={setSlPriceType}
          error={!validation.ok ? validation.slError : undefined}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-muted-foreground text-xs" htmlFor="tpsl-slippage">
          Slippage %
        </label>
        <Input
          id="tpsl-slippage"
          value={slippage}
          onChange={(event) => setSlippage(event.target.value)}
          inputMode="decimal"
          className="w-24"
          aria-invalid={!validSlippage}
        />
        <span className="text-muted-foreground text-[0.7rem]">Default 90% for lowcaps.</span>
      </div>

      <Button
        type="button"
        size="lg"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        data-testid="tpsl-submit"
        className="w-full"
      >
        {mutation.isPending ? <Spinner className="size-4" /> : null}
        {mutation.isPending ? "Submitting…" : "Submit TP/SL"}
      </Button>

      {mutation.error ? (
        <ResultError testId="tpsl-error" kind={mutation.error.kind} message={mutation.error.message} />
      ) : null}
      {mutation.isSuccess ? (
        <ResultSuccess testId="tpsl-success">
          Handler accepted (200). Sides marked <strong>processing</strong> — final confirmation arrives over the
          WebSocket.
        </ResultSuccess>
      ) : null}
    </div>
  );
}

function DeleteSideButton({
  cohQuoteId,
  side,
  disabled,
  onDelete,
}: {
  cohQuoteId?: string;
  side: "take_profit" | "stop_loss";
  disabled: boolean;
  onDelete: (cohQuoteId: string) => void;
}) {
  if (!cohQuoteId) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={() => onDelete(cohQuoteId)}
      className="text-destructive hover:text-destructive h-6 px-2 text-[0.65rem]"
      data-testid={`tpsl-delete-${side}`}
    >
      Delete
    </Button>
  );
}

function TpSlSideStateBadge({ state, hasValue }: { state: TpSlInfoState; hasValue: boolean }) {
  if (!hasValue) return null;
  switch (state) {
    case "pending":
    case "confirming":
      return <Badge variant="warning">Processing…</Badge>;
    case "new":
      return <Badge variant="positive">Active</Badge>;
    case "triggered":
      return <Badge variant="info">Triggered</Badge>;
    case "canceled":
      return <Badge variant="outline">Canceled</Badge>;
    case "killed":
      return <Badge variant="destructive">Killed</Badge>;
    case "loading":
    default:
      return null;
  }
}

function TpSlInputCard({
  label,
  price,
  onPriceChange,
  priceType,
  onPriceTypeChange,
  error,
}: {
  label: string;
  price: string;
  onPriceChange: (value: string) => void;
  priceType: TpSlPriceType;
  onPriceTypeChange: (value: TpSlPriceType) => void;
  error?: string;
}) {
  return (
    <div className="border-border/70 flex flex-col gap-2 rounded-xl border p-3">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
      <Input
        value={price}
        onChange={(event) => onPriceChange(event.target.value)}
        placeholder="0.00"
        inputMode="decimal"
        aria-invalid={Boolean(error)}
      />
      <div className="flex items-center gap-2 text-xs">
        <label>
          <input
            type="radio"
            value="markPrice"
            checked={priceType === "markPrice"}
            onChange={() => onPriceTypeChange("markPrice")}
          />{" "}
          Mark
        </label>
        <label>
          <input
            type="radio"
            value="lastPrice"
            checked={priceType === "lastPrice"}
            onChange={() => onPriceTypeChange("lastPrice")}
          />{" "}
          Last
        </label>
      </div>
      {error ? <span className="text-destructive text-[0.7rem]">{error}</span> : null}
    </div>
  );
}
