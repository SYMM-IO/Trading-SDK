import { cn } from "@theoldvarorg/ui/lib/utils";

type Tone = "positive" | "negative" | "warning" | "info" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
  info: "text-info",
  neutral: "text-muted-foreground",
};

interface Props {
  tone?: Tone;
  /** Emit an expanding ring — use for "live" / active states only. */
  pulse?: boolean;
  className?: string;
}

/**
 * A small status indicator dot. The tone sets the color; `pulse` adds a slow
 * expanding ring for live connections.
 */
export function StatusDot({ tone = "neutral", pulse = false, className }: Props) {
  return (
    <span className={cn("relative inline-flex size-2 items-center justify-center", TONE_TEXT[tone], className)}>
      {pulse ? <span className="animate-pulse-ring absolute inset-0 rounded-full" aria-hidden /> : null}
      <span className="relative size-2 rounded-full bg-current" />
    </span>
  );
}
