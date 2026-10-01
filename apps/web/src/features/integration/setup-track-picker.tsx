"use client";

import { Badge } from "@symmio/ui/components/badge";
import { cn } from "@symmio/ui/lib/utils";
import { getSetupStepIds, SETUP_TRACKS, type SetupTrack } from "./setup-track";

interface Props {
  value: SetupTrack;
  onChange: (track: SetupTrack) => void;
  /** The connected chain carries a GaslessQ relayer. Without one, only the wallet track is reachable. */
  relayerAvailable: boolean;
  /** How many of the chosen track's prerequisites are already met, keyed by track. */
  completedByTrack: Readonly<Record<SetupTrack, number>>;
}

/**
 * The first decision of the setup wizard: how this integration will sign and
 * pay for writes.
 *
 * The three options are rendered as one ladder rather than a segmented switch,
 * because they are cumulative — each is the previous one plus a prerequisite —
 * and the reader's real question is "what does the next rung cost me". Each
 * card therefore states what signs, who pays the gas, and how many steps it
 * adds, with progress carried across so switching tracks never looks like
 * starting over.
 */
export function SetupTrackPicker({ value, onChange, relayerAvailable, completedByTrack }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="How writes are signed and paid for"
      className="grid gap-3 @3xl/console:grid-cols-3"
    >
      {SETUP_TRACKS.map((track) => {
        const blocked = track.needsRelayer && !relayerAvailable;
        const active = track.value === value;
        /** The terminus is not a prerequisite, so it never counts toward the total. */
        const total = getSetupStepIds(track.value).length - 1;
        const done = completedByTrack[track.value];

        return (
          <button
            key={track.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={blocked}
            onClick={() => {
              if (!blocked) onChange(track.value);
            }}
            data-testid={`setup-track-${track.value}`}
            className={cn(
              "focus-visible:ring-ring/40 flex flex-col gap-2 rounded-xl border p-4 text-left transition-all outline-none focus-visible:ring-2",
              blocked
                ? "border-border/50 bg-muted/20 cursor-not-allowed opacity-60"
                : active
                  ? "border-primary/40 bg-primary/5 ring-primary/20 ring-1"
                  : "border-border/70 hover:border-border hover:bg-muted/40",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground text-sm font-medium">{track.label}</span>
              {blocked ? (
                <Badge variant="outline">No relayer</Badge>
              ) : (
                <Badge variant={done === total ? "positive" : active ? "default" : "outline"} className="tabular-nums">
                  {done}/{total}
                </Badge>
              )}
            </div>
            <span className="text-foreground/90 text-xs leading-5">{track.tagline}</span>
            <span className="text-muted-foreground text-xs leading-5">
              {blocked ? "This chain has no GaslessQ relayer, so nothing here can be relayed." : track.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}
