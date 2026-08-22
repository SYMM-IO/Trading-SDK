"use client";

import { Button } from "@/components/button";
import { Chips } from "@/components/chips";
import { Field, UnitSwitch } from "@/components/field";
import { LeverageSlider } from "@/components/leverage-slider";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { SolverPill } from "@/components/pill";
import { Segmented } from "@/components/segmented";
import { SideToggle } from "@/components/side-toggle";
import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast";
import { Numeric, ReceiptRow } from "@/components/value";
import { useFundingAccounts } from "@/features/accounts/account-provider";
import type { PrismMarket } from "@/features/markets/types";
import { useDescribeRequestError } from "@/features/sdk/describe-request-error";
import { useChainGate } from "@/features/wallet/use-chain-gate";
import { useTradingDelegation } from "@/features/wallet/use-trading-delegation";
import { formatLeverage, formatPercent, formatPrice, formatUsd, marketDisplayName } from "@/lib/format";
import { PositionType, SubAccountIsolationType, isolationTypeForSide } from "@symmio/trading-core";
import {
  useInstantOpenWithTpSl,
  useLimitOpenAuto,
  usePredictedNextVirtualAccount,
  useSupportsLimitOrder,
  useTpSlSupported,
  useWalletAccount,
} from "@symmio/trading-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { EMPTY_TPSL, TpSlFields, useTpSlValidation, type TpSlDraft } from "./tpsl-fields";
import { describeViolation, useTicketModel, type MarginUnit, type TicketModel } from "./use-ticket-model";

const SIZE_FRACTIONS = [
  { label: "25%", bps: 2_500n },
  { label: "50%", bps: 5_000n },
  { label: "75%", bps: 7_500n },
  { label: "Max", bps: 10_000n },
] as const;

const SLIPPAGE_OPTIONS = ["0.1%", "0.5%", "1%", "5%"] as const;

const ORDER_TYPES = [
  { value: "market" as const, label: "Market" },
  { value: "limit" as const, label: "Limit" },
];

export interface OrderTicketProps {
  market: PrismMarket;
  /** Limit price seeded by clicking an order-book level. */
  seedPrice?: number;
}

/**
 * The order ticket.
 *
 * One ticket serves both solvers, and the differences between them are
 * *answered* rather than assumed: whether resting limit orders exist, whether
 * conditional orders exist, what the spendable ceiling is, whether a fill can be
 * quoted for a size, and what the market's own limits are all come from the SDK
 * for the market's own deployment. Where the deployments genuinely diverge —
 * Rasa publishes an accepted price band and gates on a whitelist, Enigma quotes
 * an estimated fill and isolates margin into a Virtual Account — the ticket asks
 * a capability predicate, never a solver id.
 *
 * ## The gate ladder
 *
 * Exactly one call to action is shown at a time, in the order the user has to
 * satisfy them: connect → create an account → authorise trading (switching chain
 * first, if the wallet is elsewhere) → deposit collateral → place the order.
 * Showing "no funding account" to a visitor who has not connected a wallet — as
 * this ticket used to — names the wrong remedy for the actual problem.
 *
 * The chain rung sits with the authorisation deliberately, not at the top. The
 * order is signed by the session key and relayed to the solver over HTTP, so it
 * never reaches the browser wallet and does not care which chain that wallet is
 * on; only the one-time `grantDelegation` is a transaction the wallet sends. A
 * chain gate above the ladder made a trader with a live delegation on HyperEVM
 * switch back and forth to place orders the wallet was not involved in.
 */
export function OrderTicket({ market: entry, seedPrice }: OrderTicketProps) {
  const { chainId, solverId } = entry.deployment;
  const { selected: selectedAccounts, byFamily } = useFundingAccounts();
  const { isConnected } = useWalletAccount();
  const toast = useToast();
  const gate = useChainGate(entry.deployment);
  const describeError = useDescribeRequestError(entry.deployment);

  const account = selectedAccounts[entry.family];
  const accountsOnDeployment = byFamily[entry.family];

  const [side, setSide] = useState<PositionType>(PositionType.LONG);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [margin, setMargin] = useState("");
  const [unit, setUnit] = useState<MarginUnit>("usd");
  const [limitPrice, setLimitPrice] = useState("");
  const [leverage, setLeverage] = useState(() => Math.min(5, entry.market.maxLeverage));
  /* Lowcap fills move further than majors, so the default follows the market's
     own pricing model rather than one global number. */
  const [slippage, setSlippage] = useState(entry.market.kind === "enigma" ? 5 : 1);
  const [tpslOn, setTpslOn] = useState(false);
  const [tpsl, setTpsl] = useState<TpSlDraft>(EMPTY_TPSL);

  /* Capability probes, not solver ids: Base declares `limitOrder`, HyperEVM
     carries a `tpsl` block, and either could change without touching this file. */
  const supportsLimit = useSupportsLimitOrder({ chainId, solverId });
  const tpslSupported = useTpSlSupported({ chainId, solverId });

  const model = useTicketModel({
    market: entry,
    account,
    side,
    margin,
    unit,
    leverage,
    slippage,
    orderType,
    limitPrice,
  });
  const delegation = useTradingDelegation(account);

  /* A clicked book level is a *new* value for the field every time, so the price
     is controlled state seeded by an effect. As an uncontrolled `defaultValue`
     it applied on mount only — the first click did nothing because the field was
     not mounted, and every later click was ignored. */
  useEffect(() => {
    if (seedPrice === undefined) return;
    if (supportsLimit) setOrderType("limit");
    setLimitPrice(String(seedPrice));
  }, [seedPrice, supportsLimit]);

  /* A solver that cannot rest an order must never be left holding the tab. */
  useEffect(() => {
    if (!supportsLimit) setOrderType("market");
  }, [supportsLimit]);

  const isCrossMargin = account?.detail.isolationType === SubAccountIsolationType.CUSTOM;

  /* The Virtual Account this open is about to create. It does not exist
     on-chain yet, which is exactly why TP/SL has to be signed against the
     *predicted* address — and why a cross-margin account skips the leg. */
  const predictedVa = usePredictedNextVirtualAccount({
    subAccount: account?.address,
    isolationType: isolationTypeForSide(side),
    symbolId: BigInt(entry.market.symbolId),
    chainId,
    query: { enabled: Boolean(account) && tpslOn && tpslSupported && !isCrossMargin },
  });

  const tpslValidation = useTpSlValidation(tpsl, {
    market: entry,
    side,
    openPrice: model.referencePrice,
    enabled: tpslOn && tpslSupported,
  });

  const open = useInstantOpenWithTpSl();
  const limitOpen = useLimitOpenAuto();

  const isPending = open.isPending || limitOpen.isPending;

  const marginValue = Number(margin) || 0;
  const ceiling = model.available.isKnown ? model.available.usd : undefined;
  const collateral = Number(model.initialMargin) || 0;
  /* Only a *known* ceiling can reject an order. `availableMargin` reads "0"
     while the balance loads, when it errors, and when the account is genuinely
     empty; comparing against that string let all three through. */
  const exceedsAvailable = ceiling !== undefined && collateral > ceiling;

  const blocker = useMemo<Blocker | undefined>(() => {
    if (!isConnected) return { kind: "connect" };
    if (accountsOnDeployment.length === 0 || !account) return { kind: "no-account" };
    if (!delegation.sessionKey) return { kind: "session-key" };
    if (delegation.isLoading) return { kind: "checking" };
    /* The grant is the only wallet transaction on this ladder — the order itself
       is signed by the session key and relayed to the solver over HTTP — so the
       chain rung belongs here and nowhere earlier. Above this line it blocked
       whitelist registration (a bare HTTP GET), session-key creation (local),
       and the order itself, none of which the wallet ever sees. */
    if (!delegation.isActive) return gate.ready ? { kind: "delegation" } : { kind: "chain" };
    if (model.solver.offline) return { kind: "solver-offline" };
    if (model.marketClosed) return { kind: "market-closed", reason: model.marketClosed };
    if (model.available.error) return { kind: "balance-error" };
    if (!model.available.isKnown) return { kind: "loading-balance" };
    if (ceiling !== undefined && ceiling <= 0) return { kind: "unfunded" };
    if (marginValue <= 0) return { kind: "no-amount" };
    if (exceedsAvailable) return { kind: "exceeds" };
    if (orderType === "limit" && !(Number(limitPrice) > 0)) return { kind: "no-limit-price" };
    if (model.violations.length > 0) return { kind: "violation" };
    if (tpslOn && tpslValidation.hasError) return { kind: "tpsl" };
    if (!model.trade) return { kind: "pricing" };
    return undefined;
  }, [
    isConnected,
    gate.ready,
    accountsOnDeployment.length,
    account,
    model.solver.offline,
    model.marketClosed,
    model.available.error,
    model.available.isKnown,
    model.violations.length,
    model.trade,
    delegation.sessionKey,
    delegation.isLoading,
    delegation.isActive,
    ceiling,
    marginValue,
    exceedsAvailable,
    orderType,
    limitPrice,
    tpslOn,
    tpslValidation.hasError,
  ]);

  function submit() {
    if (!account || !delegation.sessionKey || !model.trade) return;

    const trade = model.trade;
    const label = `${side === PositionType.LONG ? "Long" : "Short"} ${marketDisplayName(entry.market.name)}`;
    const pending = toast.push({
      title: `${entry.deployment.solverTag} matching…`,
      body: `${label} · ${formatLeverage(leverage)}`,
      tone: "pending",
    });

    function onError(error: unknown) {
      const described = describeError(error, "Order rejected");
      if (described.isSilent) {
        toast.dismiss(pending);
        return;
      }
      toast.update(pending, { title: described.title, body: described.body, tone: "error" });
    }

    /* `from` is the session key, not the wallet. That is what signs the order
       locally with no popup — and what makes the delegation rung of the ladder
       a hard precondition rather than a nicety. */
    const common = {
      chainId,
      solverId,
      from: delegation.sessionKey,
      subAccountAddress: account.address,
      market: {
        id: entry.market.symbolId,
        name: entry.market.name,
        pricePrecision: entry.market.pricePrecision,
        quantityPrecision: entry.market.quantityPrecision,
      },
      positionType: side,
      initialMargin: model.initialMargin,
      leverage,
    };

    if (orderType === "limit") {
      /* A limit order carries no slippage: the price the user typed *is* the
         price, and the SDK's limit path passes `slippage: 0` for that reason. */
      limitOpen.mutate(
        { ...common, price: limitPrice },
        {
          onSuccess: () => {
            toast.update(pending, {
              title: `Order resting · ${label}`,
              body: `${formatUsd(Number(trade.notional))} at ${formatPrice(Number(limitPrice), entry.market.pricePrecision)}. It fills when the solver reaches your price.`,
              tone: "warn",
            });
            setMargin("");
          },
          onError,
        },
      );
      return;
    }

    const virtualAccount = predictedVa.data;
    const attachTpSl = tpslOn && tpslSupported && tpslValidation.isSubmittable && virtualAccount !== undefined;

    open.mutate(
      {
        ...common,
        slippage,
        ...(attachTpSl && virtualAccount
          ? {
              tpsl: {
                from: delegation.sessionKey,
                virtualAccount,
                subAccount: account.address,
                symbolId: BigInt(entry.market.symbolId),
                positionType: side,
                quantity: trade.quantity,
                pricePrecision: entry.market.pricePrecision,
                slippage,
                ...(tpsl.takeProfit ? { tp: { triggerPrice: tpsl.takeProfit, priceType: tpsl.priceType } } : {}),
                ...(tpsl.stopLoss ? { sl: { triggerPrice: tpsl.stopLoss, priceType: tpsl.priceType } } : {}),
              },
            }
          : {}),
      },
      {
        onSuccess: (result) => {
          /* A 200 from the solver means *accepted*, not filled: the response
             carries a temporary id and no on-chain quote. The blotter's
             lifecycle reports the fill, so the toast must not claim a price the
             solver never quoted. */
          if (result.tpslError) {
            const described = describeError(result.tpslError, "TP/SL not attached");
            toast.update(pending, {
              title: "Order submitted · TP/SL failed",
              body: `${label} is being matched, but the conditional orders were rejected: ${described.body}`,
              tone: "warn",
            });
          } else {
            toast.update(pending, {
              title: `Order submitted · ${label}`,
              body: `${formatUsd(Number(trade.notional))} notional · ${formatLeverage(leverage)}. Watch the blotter for the fill.`,
              tone: side === PositionType.LONG ? "long" : "short",
            });
          }
          setMargin("");
          setTpsl(EMPTY_TPSL);
        },
        onError,
      },
    );
  }

  return (
    <Panel className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PanelHeader title="Order" actions={<SolverPill family={entry.family} />} />

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain p-4">
        <SideToggle value={side} onChange={setSide} />

        {supportsLimit ? (
          <Segmented options={ORDER_TYPES} value={orderType} onChange={setOrderType} size="sm" />
        ) : (
          <p className="text-2xs leading-relaxed text-fg-3">
            {entry.deployment.solverName} fills at market — this solver declares no resting-order support, so there is
            no limit tab to offer.
          </p>
        )}

        {orderType === "limit" ? (
          <Field
            label="Limit price"
            value={limitPrice}
            onChange={(event) => setLimitPrice(event.target.value)}
            inputMode="decimal"
            placeholder={model.markPrice ? formatPrice(model.markPrice, entry.market.pricePrecision) : "0.00"}
            footnote={
              model.priceBand
                ? `${entry.deployment.solverName} accepts ${formatPrice(model.priceBand.min, entry.market.pricePrecision)} – ${formatPrice(model.priceBand.max, entry.market.pricePrecision)}.`
                : "Rests until the solver reaches your price."
            }
          />
        ) : null}

        <Field
          label="Margin"
          value={margin}
          onChange={(event) => setMargin(event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          invalid={exceedsAvailable}
          hint={<AvailableHint model={model} hasAccount={Boolean(account)} />}
          adornment={
            <UnitSwitch
              options={["usd", "asset"] as const}
              value={unit}
              onChange={setUnit}
              render={(option) => (option === "usd" ? "USD" : entry.market.symbol)}
            />
          }
          footnote={
            exceedsAvailable
              ? `Above the ${entry.deployment.solverName} ceiling for this leverage and side.`
              : model.trade
                ? `Opens ${model.trade.quantity} ${entry.market.symbol}${unit === "asset" ? ` · ${formatUsd(collateral, { exact: true })} collateral` : ""}`
                : undefined
          }
        />

        <Chips
          options={SIZE_FRACTIONS.map((fraction) => fraction.label)}
          onChange={(label) => {
            const fraction = SIZE_FRACTIONS.find((option) => option.label === label);
            if (!fraction || model.available.wei === undefined) return;
            /* Scaled in wei and truncated, never `usd * 0.25`: a half-up round
               on the display number lands above the real ceiling and gets the
               order rejected for a cent. */
            const scaled = (model.available.wei * fraction.bps) / 10_000n;
            setUnit("usd");
            setMargin(trimTo(formatUnits(scaled, 18), 2));
          }}
        />

        <LeverageSlider value={leverage} onChange={setLeverage} max={entry.market.maxLeverage} />

        {orderType === "market" ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <MicroLabel>Slippage</MicroLabel>
              <span className="tnum ml-auto text-sm text-fg-2">{slippage}%</span>
            </div>
            {/* Not cosmetic: slippage shifts the signed request price *and* caps
                the spendable ceiling on a short, so pinning it to an invisible
                1% silently moved both. */}
            <Chips
              options={SLIPPAGE_OPTIONS}
              value={`${slippage}%`}
              onChange={(option) => setSlippage(Number(option.replace("%", "")))}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-line-subtle pt-3">
          <Switch
            checked={tpslOn && tpslSupported}
            onChange={setTpslOn}
            disabled={!tpslSupported || orderType === "limit"}
            label="Take profit / stop loss"
          />
          {!tpslSupported ? <span className="text-2xs text-fg-3">not on {entry.deployment.solverName}</span> : null}
        </div>

        {tpslOn && tpslSupported && orderType === "market" ? (
          <TpSlFields market={entry} side={side} draft={tpsl} onChange={setTpsl} validation={tpslValidation} />
        ) : null}

        <Receipt market={entry} model={model} leverage={leverage} />

        {model.violations.length > 0 ? (
          <ul className="flex flex-col gap-1.5 rounded-md border border-[var(--short-500)]/40 bg-short-bg p-3">
            {model.violations.map((violation) => (
              <li key={violation.kind} className="text-2xs leading-relaxed text-fg-1">
                {describeViolation(violation, entry.market.symbol)}
              </li>
            ))}
          </ul>
        ) : null}

        {model.capError ? (
          <p className="rounded-md border border-warn/40 bg-warn-bg p-2.5 text-2xs leading-relaxed text-fg-1">
            {entry.deployment.solverName} is not publishing a cap for this market: {model.capError}
          </p>
        ) : null}

        {model.available.error ? (
          <p className="rounded-md border border-warn/40 bg-warn-bg p-2.5 text-2xs leading-relaxed text-fg-1">
            Couldn&rsquo;t read this account&rsquo;s spendable margin, so the ceiling is unknown and the ticket will not
            submit. {model.available.error.message}
          </p>
        ) : null}

        <LiquidationMeter model={model} side={side} isCrossMargin={Boolean(isCrossMargin)} />

        {delegation.isActive && delegation.isExpiringSoon ? (
          /* Re-signing is a wallet transaction, so off-chain this nudge has to
             move the wallet first — a bare `grant` here threw where the ladder
             below would have offered a switch. */
          <button
            type="button"
            onClick={gate.ready ? delegation.grant : () => void gate.switchToDeployment()}
            className="cursor-pointer rounded-md border border-warn/40 bg-warn-bg p-2.5 text-left text-2xs leading-relaxed text-fg-1"
          >
            This account&rsquo;s trading authorisation expires soon.{" "}
            {gate.ready
              ? "Re-sign now — an expired one is rejected on-chain exactly like a missing one."
              : `Switch to ${gate.targetName} to re-sign — an expired one is rejected on-chain exactly like a missing one.`}
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-line-subtle p-4">
        <TicketAction
          blocker={blocker}
          entry={entry}
          side={side}
          gate={gate}
          delegation={delegation}
          isPending={isPending}
          onSubmit={submit}
        />

        <p className="text-2xs leading-relaxed text-fg-3">
          Routed by {entry.deployment.solverTag} on {entry.deployment.chainName}. Settles against{" "}
          {account ? account.name : "—"}
          {account ? (isCrossMargin ? " · cross-margin" : " · isolated Virtual Account") : ""}.
        </p>
      </div>
    </Panel>
  );
}

/** The first unmet precondition, in ladder order. */
type Blocker =
  | { kind: "connect" }
  | { kind: "chain" }
  | { kind: "no-account" }
  | { kind: "session-key" }
  | { kind: "checking" }
  | { kind: "delegation" }
  | { kind: "solver-offline" }
  | { kind: "market-closed"; reason: string }
  | { kind: "balance-error" }
  | { kind: "loading-balance" }
  | { kind: "unfunded" }
  | { kind: "no-amount" }
  | { kind: "exceeds" }
  | { kind: "no-limit-price" }
  | { kind: "violation" }
  | { kind: "tpsl" }
  | { kind: "pricing" };

/** The `AVAIL` caption: a number only when the number is actually known. */
function AvailableHint({ model, hasAccount }: { model: TicketModel; hasAccount: boolean }) {
  if (!hasAccount) {
    return (
      <>
        AVAIL <span className="text-fg-3">—</span>
      </>
    );
  }
  if (model.available.error) {
    return (
      <>
        AVAIL <span className="text-warn">unavailable</span>
      </>
    );
  }
  if (!model.available.isKnown) {
    return (
      <>
        AVAIL <span className="text-fg-3">…</span>
      </>
    );
  }
  return (
    <>
      AVAIL <span className="tnum text-fg-2">{formatUsd(model.available.usd, { exact: true })}</span>
    </>
  );
}

interface ReceiptProps {
  market: PrismMarket;
  model: TicketModel;
  leverage: number;
}

/**
 * What this order costs and what it locks.
 *
 * Every figure is the SDK's, including the fee — which the spendable ceiling has
 * always subtracted silently — and the locked legs, which are what the account
 * actually gives up rather than the number typed into the field.
 */
function Receipt({ market: entry, model, leverage }: ReceiptProps) {
  const trade = model.trade;
  const lockedTotal = trade ? Number(trade.cva) + Number(trade.lf) + Number(trade.partyAmm) : undefined;

  if (!trade) {
    return (
      <div className="flex flex-col border-t border-line-subtle pt-2.5">
        <p className="py-2 text-2xs text-fg-3">
          {model.markPrice === undefined
            ? "Waiting for a mark price…"
            : !model.isReady
              ? "Loading this market's margin parameters…"
              : "Enter an amount to price the order."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-t border-line-subtle pt-2.5">
      <ReceiptRow
        label="Order value"
        value={
          <Numeric size="sm" tone="strong">
            {formatUsd(Number(trade.notional), { exact: true })}
          </Numeric>
        }
      />
      <ReceiptRow
        label="Position size"
        value={
          <Numeric size="sm">
            {trade.quantity} {entry.market.symbol}
          </Numeric>
        }
      />
      <ReceiptRow
        label={model.estimatedPrice !== undefined ? "Estimated fill" : "Request price"}
        value={
          <Numeric size="sm" tone="strong">
            {formatPrice(model.estimatedPrice ?? Number(trade.requestedOpenPrice), entry.market.pricePrecision)}
          </Numeric>
        }
      />
      {model.priceImpact !== undefined && Math.abs(model.priceImpact) > 0.001 ? (
        <ReceiptRow
          label="Price impact"
          value={
            <Numeric size="sm" tone={Math.abs(model.priceImpact) > 1 ? "warn" : "muted"}>
              {formatPercent(model.priceImpact, { signed: true })}
            </Numeric>
          }
        />
      ) : null}
      {model.priceBand ? (
        <ReceiptRow
          label="Accepted band"
          value={
            <Numeric size="sm" tone="muted">
              {formatPrice(model.priceBand.min, entry.market.pricePrecision)} –{" "}
              {formatPrice(model.priceBand.max, entry.market.pricePrecision)}
            </Numeric>
          }
        />
      ) : null}
      {lockedTotal !== undefined ? (
        <ReceiptRow
          label="Margin locked"
          value={
            <Numeric size="sm" tone="strong">
              {formatUsd(lockedTotal, { exact: true })}
            </Numeric>
          }
        />
      ) : null}
      <ReceiptRow
        label="Fees (open + close)"
        value={
          <Numeric size="sm" tone={model.fee === undefined ? "muted" : "strong"}>
            {model.fee === undefined ? "—" : formatUsd(Number(model.fee), { exact: true })}
          </Numeric>
        }
      />
      {model.lockedParams ? (
        <p className="pt-1.5 text-2xs text-fg-3">
          Locks CVA {model.lockedParams.cva ?? "—"}% + LF {model.lockedParams.lf ?? "—"}% at {formatLeverage(leverage)},
          per {entry.deployment.solverName}.
        </p>
      ) : null}
    </div>
  );
}

/** Projected liquidation for the position this order would create. */
function LiquidationMeter({
  model,
  side,
  isCrossMargin,
}: {
  model: TicketModel;
  side: PositionType;
  isCrossMargin: boolean;
}) {
  const reference = model.trade ? Number(model.trade.requestedOpenPrice) : undefined;
  const distance =
    reference && model.liquidationPrice ? Math.abs((model.liquidationPrice - reference) / reference) * 100 : undefined;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line bg-bg-2 p-3">
      <div className="flex items-center justify-between">
        <MicroLabel>Liquidation price</MicroLabel>
        <Numeric size="md" tone="warn">
          {model.liquidationPrice === undefined ? "—" : formatPrice(model.liquidationPrice, model.pricePrecision)}
        </Numeric>
      </div>
      {distance !== undefined ? (
        <>
          <div className="h-1 overflow-hidden rounded-full bg-bg-0">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(2, Math.min(100, distance))}%`,
                background: distance < 10 ? "var(--short-500)" : distance < 25 ? "var(--warn-500)" : "var(--long-500)",
              }}
            />
          </div>
          <span className="text-2xs leading-relaxed text-fg-3">
            {formatPercent(distance)} {side === PositionType.LONG ? "down" : "up"} from your entry
            {isCrossMargin ? " — for this position alone; on a cross-margin account it nets against the others." : ""}
          </span>
        </>
      ) : null}
    </div>
  );
}

interface TicketActionProps {
  blocker: Blocker | undefined;
  entry: PrismMarket;
  side: PositionType;
  gate: ReturnType<typeof useChainGate>;
  delegation: ReturnType<typeof useTradingDelegation>;
  isPending: boolean;
  onSubmit: () => void;
}

/**
 * The one call to action, chosen by the first unmet precondition.
 *
 * Each branch names the remedy for its own state rather than a generic
 * "unavailable": the point of a ladder is that the user always knows the next
 * step, and never sees two competing buttons.
 */
function TicketAction({ blocker, entry, side, gate, delegation, isPending, onSubmit }: TicketActionProps) {
  if (!blocker) {
    return (
      <Button variant={side === PositionType.LONG ? "long" : "short"} size="lg" loading={isPending} onClick={onSubmit}>
        {side === PositionType.LONG ? "Open long" : "Open short"} {marketDisplayName(entry.market.name)}
      </Button>
    );
  }

  switch (blocker.kind) {
    case "connect":
      return (
        <Button variant="secondary" size="lg" disabled>
          Connect a wallet to trade
        </Button>
      );

    case "chain":
      return (
        <Button variant="primary" size="lg" loading={gate.isSwitching} onClick={() => void gate.switchToDeployment()}>
          Switch to {gate.targetName}
        </Button>
      );

    case "no-account":
      return <CtaLink href="/portfolio">Create a {entry.deployment.label.toLowerCase()} account</CtaLink>;

    case "session-key":
      return (
        <Button variant="secondary" size="lg" disabled loading>
          Preparing your session key…
        </Button>
      );

    case "checking":
      return (
        <Button variant="secondary" size="lg" disabled loading>
          Checking this account&rsquo;s permissions…
        </Button>
      );

    case "delegation":
      return (
        <div className="flex flex-col gap-1.5">
          <Button variant="primary" size="lg" loading={delegation.isGranting} onClick={delegation.grant}>
            Enable trading
          </Button>
          <span className="text-2xs leading-relaxed text-fg-3">
            One wallet signature authorises this account&rsquo;s session key to open, close and top up positions. Every
            order after that signs locally, with no popup.
          </span>
        </div>
      );

    case "solver-offline":
      return (
        <Button variant="secondary" size="lg" disabled>
          {entry.deployment.solverName} is not accepting orders
        </Button>
      );

    case "market-closed":
      return (
        <Button variant="secondary" size="lg" disabled>
          {blocker.reason}
        </Button>
      );

    case "balance-error":
      return (
        <Button variant="secondary" size="lg" disabled>
          Couldn&rsquo;t read your balance
        </Button>
      );

    case "loading-balance":
      return (
        <Button variant="secondary" size="lg" disabled loading>
          Reading your balance…
        </Button>
      );

    case "unfunded":
      return (
        <div className="flex flex-col gap-1.5">
          <CtaLink href="/portfolio">Deposit collateral</CtaLink>
          <span className="text-2xs leading-relaxed text-fg-3">
            This account has nothing to trade with on {entry.deployment.chainName}.
          </span>
        </div>
      );

    case "no-amount":
      return (
        <Button variant="secondary" size="lg" disabled>
          Enter an amount
        </Button>
      );

    case "exceeds":
      return (
        <Button variant="secondary" size="lg" disabled>
          Above your available margin
        </Button>
      );

    case "no-limit-price":
      return (
        <Button variant="secondary" size="lg" disabled>
          Enter a limit price
        </Button>
      );

    case "violation":
      return (
        <Button variant="secondary" size="lg" disabled>
          This order breaks a market rule
        </Button>
      );

    case "tpsl":
      return (
        <Button variant="secondary" size="lg" disabled>
          Fix the take profit / stop loss
        </Button>
      );

    case "pricing":
      return (
        <Button variant="secondary" size="lg" disabled loading>
          Pricing the order…
        </Button>
      );
  }
}

/** A primary CTA that navigates instead of submitting. */
function CtaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-accent px-5 text-lg font-semibold whitespace-nowrap text-fg-inverse transition-all duration-[var(--dur-fast)] hover:brightness-110"
    >
      {children}
    </Link>
  );
}

/** Truncate a decimal string to `places`, never rounding up past a ceiling. */
function trimTo(value: string, places: number): string {
  const [whole = "0", fraction = ""] = value.split(".");
  if (places <= 0) return whole;
  return `${whole}.${fraction.padEnd(places, "0").slice(0, places)}`;
}
