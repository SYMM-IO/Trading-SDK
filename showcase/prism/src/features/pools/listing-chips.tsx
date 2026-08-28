import { Pill } from "@/components/pill";
import type { ListingMarketStatus } from "@symmio/trading-core";
import { listingStatusStyle } from "./listing-values";

export interface LifecyclePillProps {
  /** The label to print. Uppercased by the chip's own type rule. */
  label: string;
  /** A lifecycle color token — `var(--state-…)`, never a family hue. */
  color: string;
  /** Leading status dot. On for a chip that reports a live state, off for a label. */
  dot?: boolean;
  className?: string;
}

/**
 * A chip that carries its own lifecycle color.
 *
 * The tint formula is the quote state pill's: the color at 13% for the fill and
 * 26% for the border. It lives in one place because four surfaces on this
 * feature need it — a catalog row, a pool header, a status panel and two
 * books — and a hand-inlined copy drifted its border alpha the first time.
 *
 * These hues are lifecycle hues and stay put through a palette switch: a red
 * "Rejected" must not read as "lowcaps".
 */
export function LifecyclePill({ label, color, dot = false, className }: LifecyclePillProps) {
  return (
    <Pill
      color={color}
      background={`color-mix(in srgb, ${color} 13%, transparent)`}
      border={`color-mix(in srgb, ${color} 26%, transparent)`}
      /* A chip dropped into a grid row is a grid item, and a grid item stretches
         to its track — an `inline-flex` chip included. */
      className={className ?? "w-fit"}
      dot={dot}
    >
      {label}
    </Pill>
  );
}

/** The listing status of a pool, as a lifecycle chip. */
export function ListingStatusPill({
  status,
  dot = false,
  className,
}: {
  status: ListingMarketStatus;
  dot?: boolean;
  className?: string;
}) {
  const style = listingStatusStyle(status);
  return <LifecyclePill label={style.label} color={style.color} dot={dot} className={className} />;
}

/**
 * The warning triangle every cautionary band on this feature uses.
 *
 * Prism draws its icons rather than shipping a set, which is exactly why they
 * belong in one file: four hand-copied triangles had already drifted into two
 * geometries before this existed.
 */
export function WarnGlyph({ className = "mt-px size-3.5 shrink-0 text-warn" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className}>
      <path d="M8 1.5 15 14H1L8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}
