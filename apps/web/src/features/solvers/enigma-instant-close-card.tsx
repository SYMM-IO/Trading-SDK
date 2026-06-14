"use client";

import { ResultError, ResultNote } from "@/components/result";
import { ClosePositionStep, type ClosablePosition } from "@/features/integration/close-position-step";
import { useSessionKey } from "@/features/session-keys/use-session-key";
import { PositionType, usePartyAOpenPositions } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { cn } from "@symm-frontier/ui/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUnits, isAddress, type Address } from "viem";
import { MethodCard } from "../inspector/method-card";
import { PartyAField } from "../inspector/party-a-field";

const WEI_DECIMALS = 18;

/**
 * Solvers-page wrapper around the shared {@link ClosePositionStep}. The card
 * gates the form on (a) a typed `partyA` (VA address), (b) an initialized
 * session key, and (c) a picked position from the on-chain
 * `getPartyAOpenPositions(partyA)` read. The wizard in the Integration tab
 * does the same gating behind a multi-step rail; this card inlines it.
 */
export function EnigmaInstantCloseCard() {
  const [partyAInput, setPartyAInput] = useState<string>("");
  const [selectedQuoteId, setSelectedQuoteId] = useState<bigint>();
  const { sessionKeyAddress, owner: sessionKeyOwner } = useSessionKey();

  const validPartyA = isAddress(partyAInput) ? (partyAInput as Address) : undefined;
  const positionsQuery = usePartyAOpenPositions({
    partyA: validPartyA,
    start: 0n,
    size: 200n,
    query: { enabled: Boolean(validPartyA) },
  });

  const positions = useMemo<ClosablePosition[]>(
    () =>
      (positionsQuery.data ?? []).map((q) => ({
        id: q.id,
        symbolId: q.symbolId,
        positionType: q.positionType,
        quantity: q.quantity,
        closedAmount: q.closedAmount,
        lockedValues: {
          cva: q.lockedValues.cva,
          lf: q.lockedValues.lf,
          partyAmm: q.lockedValues.partyAmm,
          partyBmm: q.lockedValues.partyBmm,
        },
        partyA: q.partyA,
      })),
    [positionsQuery.data],
  );
  const selected = useMemo(() => positions.find((p) => p.id === selectedQuoteId), [positions, selectedQuoteId]);
  const ready = Boolean(validPartyA && sessionKeyAddress && selected);

  return (
    <MethodCard
      testId="method-enigma-instant-close"
      name="instantClose"
      mutability="nonpayable"
      description="Close (or partially close) a lowcap instant position via the InstantLayer v2 flow."
      wide
    >
      <PartyAField
        idPrefix="enigma-instant-close-party-a"
        label="partyA (virtual account)"
        value={partyAInput}
        onValueChange={(next) => {
          setPartyAInput(next);
          setSelectedQuoteId(undefined);
        }}
        invalid={partyAInput.length > 0 && validPartyA === undefined}
        selectable="va"
        hint="Load your subaccounts, expand one, and pick a VA — or paste an address directly."
      />

      <SessionKeyRow address={sessionKeyAddress} owner={sessionKeyOwner} />

      <PositionsPanel
        validPartyA={validPartyA}
        positions={positions}
        isLoading={positionsQuery.isLoading}
        error={positionsQuery.error}
        selectedId={selectedQuoteId}
        onSelect={setSelectedQuoteId}
      />

      {ready ? (
        <ClosePositionStep
          partyA={validPartyA!}
          sessionKey={sessionKeyAddress!}
          position={selected!}
          onRefreshPosition={() => void positionsQuery.refetch()}
          isRefreshingPosition={positionsQuery.isRefetching}
          idPrefix="enigma-instant-close"
        />
      ) : (
        <ResultNote testId="enigma-instant-close-gate">
          {!validPartyA
            ? "Enter a partyA (VA address) to continue."
            : !sessionKeyAddress
              ? "Initialize a session key to continue."
              : "Pick a position to close."}
        </ResultNote>
      )}
    </MethodCard>
  );
}

function PositionsPanel({
  validPartyA,
  positions,
  isLoading,
  error,
  selectedId,
  onSelect,
}: {
  validPartyA: Address | undefined;
  positions: ClosablePosition[];
  isLoading: boolean;
  error: { kind: string; message: string } | null;
  selectedId: bigint | undefined;
  onSelect: (id: bigint) => void;
}) {
  if (!validPartyA) return null;
  if (isLoading) {
    return (
      <ResultNote testId="enigma-instant-close-positions-loading" loading>
        Loading on-chain positions…
      </ResultNote>
    );
  }
  if (error) {
    return <ResultError testId="enigma-instant-close-positions-error" kind={error.kind} message={error.message} />;
  }
  if (positions.length === 0) {
    return <ResultNote testId="enigma-instant-close-positions-none">No open positions for this VA.</ResultNote>;
  }

  return (
    <div className="grid grid-cols-1 gap-2" data-testid="enigma-instant-close-positions-list">
      {positions.map((p) => {
        const active = p.id === selectedId;
        const remaining = p.quantity - p.closedAmount;
        return (
          <button
            key={p.id.toString()}
            type="button"
            onClick={() => onSelect(p.id)}
            data-testid={`enigma-instant-close-position-${p.id.toString()}`}
            className={cn(
              "focus-visible:ring-ring/40 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2",
              active
                ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
                : "border-border/70 hover:border-border hover:bg-muted/40",
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-foreground text-sm leading-tight font-medium">
                Quote #{p.id.toString()} · symbol {p.symbolId.toString()}
              </span>
              <span className="text-muted-foreground font-mono text-[0.7rem] leading-tight">
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
  );
}

function SessionKeyRow({ address, owner }: { address: Address | null | undefined; owner: Address | undefined }) {
  const ready = Boolean(address);
  return (
    <div
      data-testid="enigma-instant-close-session-key"
      className="border-border/70 bg-muted/20 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
    >
      <span className={cn("size-2 rounded-full", ready ? "bg-positive" : "bg-warning")} aria-hidden />
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">sessionKey</span>
      <Badge variant={ready ? "positive" : "warning"} className="tracking-wide uppercase">
        {ready ? "ready" : "missing"}
      </Badge>

      {ready ? (
        <span className="text-foreground ml-auto max-w-[60%] truncate font-mono">{address}</span>
      ) : (
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-2">
          {owner ? "Not initialized for the connected wallet." : "Connect a wallet to initialize."}
          <Button asChild type="button" size="sm" variant="ghost" disabled={!owner}>
            <Link href="/session-keys">Initialize</Link>
          </Button>
        </span>
      )}
    </div>
  );
}
