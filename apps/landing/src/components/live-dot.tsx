import { cn } from "@symmio/ui/lib/utils";

/**
 * A small "live" indicator — a solid dot with a slow expanding ring. Tone maps
 * to a semantic token; defaults to the positive mint used for healthy state.
 */
export function LiveDot({ className, tone = "positive" }: { className?: string; tone?: "positive" | "primary" }) {
  const color = tone === "primary" ? "text-primary" : "text-positive";
  return (
    <span className={cn("relative inline-flex size-2 items-center justify-center", color, className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" aria-hidden />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}
