"use client";

import { ResultError } from "@/components/result";
import { calculatePriceImpact, PositionType, type EstimatedPriceEntry } from "@symmio/trading-core";
import { useEstimatedPrice } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { formatPercentage } from "@symmio/utils";
import { useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "./solver-target";

/**
 * Solvers-page card for `GET /estimated-price` — simulate an open/close and get
 * the price the solver would fill it at (read-only, no order placed). Wire the
 * SDK's `useEstimatedPrice`
 * (side + entry + quantity + the slippage-adjusted request price) and show the
 * returned price plus the signed price impact vs that request price via
 * `calculatePriceImpact`. No wallet or subaccount needed — it's a pure read.
 */
export function EnigmaEstimatedPriceCard() {
  const [symbolId, setSymbolId] = useState("1");
  const [quantity, setQuantity] = useState("1000");
  const [price, setPrice] = useState("");
  const [side, setSide] = useState<PositionType>(PositionType.LONG);
  const [entry, setEntry] = useState<EstimatedPriceEntry>("open");
  const active = useSolverKindActive("enigma");

  const parsedSymbolId = Number(symbolId);
  const query = useEstimatedPrice({
    symbolId: Number.isFinite(parsedSymbolId) ? parsedSymbolId : 0,
    quantity,
    positionType: side,
    entry,
    price,
    query: {
      enabled: active && Number.isFinite(parsedSymbolId) && quantity.trim().length > 0 && price.trim().length > 0,
    },
  });

  const estimated = query.data?.estimatedPrice;
  const impact =
    estimated && estimated !== "0"
      ? calculatePriceImpact({ estimatedPrice: estimated, referencePrice: price })
      : undefined;

  return (
    <MethodCard
      testId="method-getEstimatedPrice"
      name="getEstimatedPrice"
      mutability="view"
      description="Simulate an open or close and get the price the solver would fill it at — read-only, no order placed. Positive impact = fill above your request price."
      wide
    >
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Symbol id" value={symbolId} onChange={setSymbolId} placeholder="1" />
        <LabeledInput label="Quantity" value={quantity} onChange={setQuantity} placeholder="1000" />
        <LabeledInput label="Request price (slippage-adjusted)" value={price} onChange={setPrice} placeholder="0.09" />
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Side · entry</span>
          <div className="flex gap-1.5">
            <Toggle active={side === PositionType.LONG} onClick={() => setSide(PositionType.LONG)}>
              Long
            </Toggle>
            <Toggle active={side === PositionType.SHORT} onClick={() => setSide(PositionType.SHORT)}>
              Short
            </Toggle>
            <span className="bg-border/70 w-px" aria-hidden />
            <Toggle active={entry === "open"} onClick={() => setEntry("open")}>
              Open
            </Toggle>
            <Toggle active={entry === "close"} onClick={() => setEntry("close")}>
              Close
            </Toggle>
          </div>
        </div>
      </div>

      <div className="border-border/60 bg-muted/30 flex items-center justify-between rounded-xl border px-4 py-3">
        <span className="text-muted-foreground text-xs">Estimated price</span>
        {query.isFetching ? (
          <Spinner className="size-4" />
        ) : estimated && estimated !== "0" ? (
          <span className="flex items-baseline gap-2 font-mono text-sm tabular-nums">
            {estimated}
            {impact !== undefined ? (
              <span className={impact >= 0 ? "text-warning text-xs" : "text-positive text-xs"}>
                ({formatPercentage(impact, { maxDecimals: 3, withSign: true })})
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground font-mono text-sm">—</span>
        )}
      </div>

      {query.error ? (
        <ResultError testId="result-getEstimatedPrice" kind={query.error.kind} message={query.error.message} />
      ) : null}
    </MethodCard>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs">
      <span className="text-muted-foreground font-medium">{label}</span>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn("px-2.5", active && "shadow-sm")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
