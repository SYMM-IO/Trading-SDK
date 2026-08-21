import { cn } from "@/lib/cn";

interface Props {
  /** Rendered box in px. The mark is square. */
  size?: number;
  className?: string;
}

/**
 * The Prism mark.
 *
 * A prism run backwards: three rays — cyan for majors, violet for the platform,
 * magenta for lowcaps — enter the glass from the left and leave it as one white
 * beam. That is the product in one glyph: separate deployments in, a single
 * surface out. The rays read their opacity from `--ray-*`, which the mode
 * blocks in `globals.css` set, so a family mode dims the other two rays and the
 * mark doubles as the mode indicator.
 *
 * `icon.svg` and `apple-icon.tsx` carry the same geometry with the colours
 * baked in — keep the three in step.
 */
export function PrismMark({ size = 22, className }: Props) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path
        d="M0 7.5 14.6 14.2 0 11Z"
        fill="var(--mj-500)"
        className="prism-mark__ray"
        style={{ opacity: "var(--ray-mj)" }}
      />
      <path
        d="M0 14.2 13.4 17.8 0 17.8Z"
        fill="var(--app-500)"
        className="prism-mark__ray"
        style={{ opacity: "var(--ray-app)" }}
      />
      <path
        d="M0 21 12.1 21.3 0 24.5Z"
        fill="var(--lc-500)"
        className="prism-mark__ray"
        style={{ opacity: "var(--ray-lc)" }}
      />
      <path
        d="M18 5 26 27H10L18 5Z"
        fill="var(--fg-0)"
        fillOpacity="0.07"
        stroke="var(--fg-0)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M22 15.6 32 13v7.5l-9.1-1.7Z" fill="var(--fg-0)" />
    </svg>
  );
}
