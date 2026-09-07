import { GaslessWriteToggle } from "@/features/gasless/gasless-write-toggle";
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
   * the relay toggle beside the write chip. The two go together: a toggle on a
   * card that drops the parameter would silently do nothing.
   */
  gaslessRelayable?: boolean;
  /**
   * Set on a `gaslessRelayable` card when the relayer cannot carry the call as
   * the card can currently build it. Renders the toggle disabled with this text
   * as its explanation. The card must pass the same value to
   * `useGaslessWriteOption` so the header and the call agree.
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
 * holds the inputs and the result panel. A write marked `gaslessRelayable` also
 * gets a {@link GaslessWriteToggle} beside its chip, so the call can be taken
 * off the relay without changing the app-wide config.
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
          <Badge variant={isWrite ? "warning" : "info"} className="ml-auto tracking-wide uppercase">
            {isWrite ? "write" : "read"}
          </Badge>
          {isWrite && gaslessRelayable ? (
            <GaslessWriteToggle method={name} blockedReason={gaslessBlockedReason} />
          ) : null}
          {magicMethodId ? <MagicPinButton methodId={magicMethodId} input={magicMethodInput} /> : null}
        </div>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
