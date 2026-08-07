"use client";

import { WEI_DECIMALS } from "@/lib/format";
import type { GroupTpSlChild, GroupTpSlDesiredMap, TpSlValidation } from "@symmio/trading-core";
import { childNotional, sharePercent } from "@symmio/trading-react";
import { Input } from "@symmio/ui/components/input";
import { cn } from "@symmio/ui/lib/utils";
import { formatTokenAmount } from "@symmio/utils";
import { useState, type ReactNode } from "react";

interface Props {
  legs: readonly GroupTpSlChild[];
  overrides: GroupTpSlDesiredMap;
  /** `true` when the legs do not all carry the same staged price on some side. */
  mixed: boolean;
  errors: Record<string, TpSlValidation>;
  onSetLeg: (key: string, side: "tp" | "sl", triggerPrice: string) => void;
  /** Rendered on the toggle row, opposite the disclosure — keeps it out of the table. */
  trailing?: ReactNode;
  disabled?: boolean;
}

/**
 * Per-leg exits, behind a disclosure.
 *
 * The rail above sets one price across the whole position, which is what a
 * trader wants almost every time. This is the exception: a merged row really is
 * separate quotes, and occasionally they want different exits per quote. Keeping
 * it collapsed stops the common case from looking like a spreadsheet.
 */
export function GroupTpSlLegs({ legs, overrides, mixed, errors, onSetLeg, trailing, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const total = legs.reduce((sum, leg) => sum + childNotional(leg), 0n);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex items-center gap-1.5 rounded-sm text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
          data-testid="group-tpsl-legs-toggle"
        >
          <Chevron open={open} />
          {legs.length} {legs.length === 1 ? "leg" : "legs"}
          <span className={mixed ? "text-primary" : "text-muted-foreground/60"}>
            {mixed ? "· prices differ" : "· same price on every leg"}
          </span>
        </button>
        {trailing}
      </div>

      {open ? (
        <table className="w-full text-[0.7rem]">
          <thead>
            <tr className="text-muted-foreground/70 text-left text-[0.6rem] tracking-[0.14em] uppercase">
              <th scope="col" className="pb-1.5 font-normal">
                size
              </th>
              <th scope="col" className="pb-1.5 font-normal">
                take profit
              </th>
              <th scope="col" className="pb-1.5 font-normal">
                stop loss
              </th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg) => {
              const share = sharePercent(childNotional(leg), total);
              const error = errors[leg.key];
              return (
                <tr key={leg.key} className="border-border/40 border-t">
                  <td className="w-32 py-1.5 align-middle">
                    <span className="text-foreground font-mono tabular-nums">
                      {formatTokenAmount(leg.openQuantity, WEI_DECIMALS, { maxFractionDigits: 4 })}
                    </span>
                    <span className="text-muted-foreground/70 ml-1.5 font-mono text-[0.65rem] tabular-nums">
                      {share === undefined
                        ? ""
                        : `${formatTokenAmount(share, WEI_DECIMALS, { maxFractionDigits: 0 })}%`}
                    </span>
                  </td>
                  <LegCell
                    leg={leg}
                    side="tp"
                    overrides={overrides}
                    message={error?.tpError}
                    onSetLeg={onSetLeg}
                    disabled={disabled}
                  />
                  <LegCell
                    leg={leg}
                    side="sl"
                    overrides={overrides}
                    message={error?.slError}
                    onSetLeg={onSetLeg}
                    disabled={disabled}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

/** One leg's price cell for one side. */
function LegCell({
  leg,
  side,
  overrides,
  message,
  onSetLeg,
  disabled,
}: {
  leg: GroupTpSlChild;
  side: "tp" | "sl";
  overrides: GroupTpSlDesiredMap;
  message?: string;
  onSetLeg: (key: string, side: "tp" | "sl", triggerPrice: string) => void;
  disabled: boolean;
}) {
  const staged = overrides[leg.key]?.[side];
  const confirmed = side === "tp" ? leg.tpsl.tp : leg.tpsl.sl;
  const value = staged ? staged.triggerPrice : confirmed;
  const tone = side === "tp" ? "text-positive" : "text-negative";
  const anchored = leg.quoteId !== undefined && leg.openQuantity > 0n;

  return (
    <td className="py-1 align-middle">
      <Input
        value={value}
        onChange={(event) => onSetLeg(leg.key, side, event.target.value)}
        placeholder={anchored ? "—" : "not yet on-chain"}
        inputMode="decimal"
        disabled={disabled || !anchored}
        aria-label={`${side === "tp" ? "Take profit" : "Stop loss"} price for the ${formatTokenAmount(leg.openQuantity, WEI_DECIMALS, { maxFractionDigits: 4 })} leg`}
        title={message}
        className={cn(
          "h-7 max-w-32 border-transparent bg-transparent px-1.5 font-mono text-[0.7rem] tabular-nums shadow-none",
          "hover:border-border/60 focus-visible:border-primary/60",
          value ? tone : "text-muted-foreground",
          message && "border-negative/70",
        )}
      />
    </td>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={cn("size-3 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")}
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
