/**
 * A ticker of everything the SDK wraps, scrolling like a market tape. Two
 * identical tracks sit side by side and the row translates by exactly half its
 * width, so the loop is seamless. Pauses on hover; frozen under
 * `prefers-reduced-motion` (see `globals.css`). Purely decorative, so the
 * duplicated track is hidden from assistive tech.
 */
const capabilities = [
  "Contract methods",
  "Solver markets",
  "Enigma prices",
  "Muon attestations",
  "Subgraph history",
  "Deposit / withdraw",
  "Quote reconciliation",
  "Session keys",
  "WebSocket feeds",
  "Chain config",
];

export function CapabilityTicker() {
  return (
    <div className="border-border/50 relative border-y py-4">
      <div
        className="pause-on-hover overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
        }}
      >
        <div className="animate-marquee flex w-max">
          <Track />
          <Track aria-hidden />
        </div>
      </div>
    </div>
  );
}

function Track({ "aria-hidden": ariaHidden }: { "aria-hidden"?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={ariaHidden}>
      {capabilities.map((label) => (
        <li key={label} className="flex items-center gap-6 pr-6">
          <span className="text-muted-foreground font-mono text-sm whitespace-nowrap">{label}</span>
          <span className="bg-primary/60 size-1.5 shrink-0 rounded-full" aria-hidden />
        </li>
      ))}
    </ul>
  );
}
