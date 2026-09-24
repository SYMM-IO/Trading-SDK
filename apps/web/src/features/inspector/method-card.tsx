import { GaslessWriteToggle } from "@/features/gasless/gasless-write-toggle";
import { SessionKeyWriteToggle } from "@/features/gasless/session-key-write-toggle";
import { MagicPinButton } from "@/features/magic-sidebar/magic-pin-button";
import { Badge } from "@symmio/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symmio/ui/components/card";
import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";

interface Props {
  testId: string;
  name: string;
  mutability: "view" | "nonpayable";
  description: string;
  children: ReactNode;
  /** Span the whole row of the methods grid, whatever its column count (for wide table results). */
  wide?: boolean;
  /** `sm` tightens the frame's padding — for a headline-figure card in a narrow four-up strip. */
  size?: "default" | "sm";
  /**
   * Set on a `nonpayable` card whose write the gasless relayer can carry **and**
   * whose body forwards `useGaslessWriteOption(name)` to its mutation. Renders
   * the relay and session-key toggles beside the write chip. The two go
   * together: a toggle on a card that drops the parameter would silently do
   * nothing. A write the relayer can never carry leaves this unset and gives
   * `gaslessBlockedReason` on its own.
   */
  gaslessRelayable?: boolean;
  /**
   * Why the relayer cannot carry this call. Renders both controls disabled with
   * this text as their explanation, so a write never leaves the reader guessing
   * whether the relay is refused or simply not wired up.
   *
   * Beside `gaslessRelayable` it marks a block the card's current inputs cause,
   * and the card must pass the same value to `useGaslessWriteOption` so the
   * header and the call agree. On its own it marks a write the relayer can
   * never carry; that card forwards nothing, because its action takes no
   * `gasless` parameter to forward.
   */
  gaslessBlockedReason?: string;
  /**
   * Catalog id of the magic-sidebar method this card reads. When set, renders a
   * pin toggle in the header that adds the method to the live board.
   */
  magicMethodId?: string;
  /**
   * The card's current primary input (e.g. partyA / quote id). Passed as the
   * pinned panel's seed so the live card inherits the card's data on pin.
   */
  magicMethodInput?: string;
}

/**
 * Visual frame for a single AccountLayer method on the Inspector page. A tinted
 * status dot and read/write chip distinguish view methods from writes; the body
 * holds the inputs and the result panel. A write gets its dispatch controls just
 * ahead of its chip — a {@link GaslessWriteToggle} and a
 * {@link SessionKeyWriteToggle} — so each card picks its own relay and signer
 * without changing the app-wide config. A write marked `gaslessRelayable` gets
 * them live; one carrying a `gaslessBlockedReason` gets them disabled, with that
 * reason on hover. Every write shows the pair one way or the other, so a missing
 * relay always reads as a refusal with a reason rather than an omission.
 */
export function MethodCard({
  testId,
  name,
  mutability,
  description,
  children,
  wide = false,
  size = "default",
  gaslessRelayable = false,
  gaslessBlockedReason,
  magicMethodId,
  magicMethodInput,
}: Props) {
  const isWrite = mutability === "nonpayable";
  /** A write shows the pair when the relayer can carry it, or when it can say why it cannot. */
  const showDispatchControls = isWrite && (gaslessRelayable || gaslessBlockedReason !== undefined);

  return (
    <Card
      id={testId}
      data-testid={testId}
      size={size}
      className={cn(
        "hover:ring-border scroll-mt-24 transition-all duration-200 hover:shadow-md",
        wide && "col-span-full",
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cn("size-2 rounded-full", isWrite ? "bg-warning" : "bg-info")} aria-hidden />
          <CardTitle className="font-mono text-[0.95rem] font-medium tracking-tight">{name}</CardTitle>
          {/* Trailing controls travel together, so a long method name wraps them as one cluster. */}
          <div className="ml-auto flex items-center gap-2">
            {showDispatchControls ? (
              /** `empty:hidden` drops the group, and its gap, on a chain with no relayer. */
              <div className="flex items-center gap-1 empty:hidden">
                <GaslessWriteToggle method={name} blockedReason={gaslessBlockedReason} />
                <SessionKeyWriteToggle method={name} gaslessBlockedReason={gaslessBlockedReason} />
              </div>
            ) : null}
            <Badge variant={isWrite ? "warning" : "info"} className="tracking-wide uppercase">
              {isWrite ? "write" : "read"}
            </Badge>
            {magicMethodId ? <MagicPinButton methodId={magicMethodId} input={magicMethodInput} /> : null}
          </div>
        </div>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
