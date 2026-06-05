"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export interface CopyButtonProps extends Omit<React.ComponentProps<"button">, "value"> {
  /** Text written to the clipboard when the button is pressed. */
  value: string;
  /** Accessible label and tooltip shown before copying. Defaults to `"Copy"`. */
  label?: string;
  /** Label and tooltip shown briefly after a successful copy. Defaults to `"Copied"`. */
  copiedLabel?: string;
  /** Skip the wrapping tooltip — use inside an element that already has one. */
  hideTooltip?: boolean;
}

/**
 * Compact icon button that copies a string to the clipboard, swaps to a check
 * for ~1.4s, and announces the result to assistive tech via an `aria-live`
 * region. Domain-agnostic — copies any string (address, tx hash, value).
 *
 * @example
 * <CopyButton value={address} label="Copy address" />
 */
function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  hideTooltip = false,
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }

  const trigger = (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? copiedLabel : label}
      data-copied={copied || undefined}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 data-copied:text-positive inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-[color,background-color] outline-none focus-visible:ring-2 [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {copied ? <Check strokeWidth={2.5} /> : <Copy strokeWidth={2} />}
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </button>
  );

  if (hideTooltip) return trigger;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>{copied ? copiedLabel : label}</TooltipContent>
    </Tooltip>
  );
}

export { CopyButton };
