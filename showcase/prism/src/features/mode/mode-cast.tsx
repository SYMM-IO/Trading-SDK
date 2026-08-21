"use client";

import { deploymentsForMode, type PrismMode } from "@/config/deployments";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { retireAnnouncement, useModeAnnouncement } from "./mode-announcer";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * How long the reveal plays before it starts clearing.
 *
 * The entrance timeline lives in `globals.css`; its last moving part is the
 * specular pass, which clears at ~1320ms for the longest word. This holds the
 * finished frame for a beat after that, so the title is read as a still.
 */
const CAST_IN_MS = 1480;
/** The clearing animation, timed to match `prism-cast-*-out` in `globals.css`. */
const CAST_OUT_MS = 440;
/** Still-frame hold used when the visitor has asked for reduced motion. */
const CAST_STILL_MS = 950;

interface ModeArt {
  /** The word, already cased for display — it is split per glyph. */
  readonly word: string;
  /** Sentence-case name, used in the screen-reader announcement. */
  readonly label: string;
  /** Identity colour: extrusion, halo, beam, kicker. */
  readonly key: string;
  /** Second stop of the mode's gradient. */
  readonly key2: string;
  /** Third stop. Only `unified` spans all three family identities. */
  readonly key3?: string;
}

/**
 * The reveal paints in *family identity* colours, not in the surface accent.
 *
 * Those are tier-1 tokens, which components normally may not touch — but a
 * market's colour is a fact about that market (`FAMILY_PALETTE` in
 * `config/deployments.ts` reads them for the same reason). Going through
 * `--accent` instead would also make the reveal depend on `<html data-mode>`
 * having already been re-pointed, which happens a paint later.
 */
const ART: Record<PrismMode, ModeArt> = {
  unified: {
    word: "UNIFIED",
    label: "Unified",
    key: "var(--app-500)",
    key2: "var(--mj-500)",
    key3: "var(--lc-500)",
  },
  majors: {
    word: "MAJORS",
    label: "Majors",
    key: "var(--mj-500)",
    key2: "var(--yellow-500)",
  },
  lowcaps: {
    word: "LOWCAPS",
    label: "Lowcaps",
    key: "var(--lc-500)",
    key2: "var(--warn-500)",
  },
};

/**
 * Light streaks thrown out from behind the word at the moment it lands.
 *
 * Shallow angles only — a radial starburst reads as a game, a near-horizontal
 * spread reads as light through a prism. `dir` picks the side; `delay` and
 * `length` break the symmetry so it does not look mechanical.
 */
const SHARDS = [
  { rotate: -19, dir: -1, length: "11vw", travel: 27, delay: 0 },
  { rotate: -7, dir: -1, length: "17vw", travel: 34, delay: 40 },
  { rotate: 5, dir: -1, length: "13vw", travel: 22, delay: 90 },
  { rotate: -5, dir: 1, length: "16vw", travel: 32, delay: 20 },
  { rotate: 9, dir: 1, length: "12vw", travel: 25, delay: 70 },
  { rotate: 21, dir: 1, length: "9vw", travel: 19, delay: 110 },
] as const;

/** The mode's gradient, mirroring the `--mode-strip` language in the header. */
function castStrip(art: ModeArt): string {
  return art.key3
    ? `linear-gradient(90deg, transparent, ${art.key2} 18%, ${art.key} 50%, ${art.key3} 82%, transparent)`
    : `linear-gradient(90deg, transparent, ${art.key} 32%, ${art.key2} 74%, transparent)`;
}

/**
 * Full-screen reveal that plays when the user switches market scope.
 *
 * Mounted once, at the top of the shell. It is inert until `setMode` publishes
 * an announcement, renders nothing on the server, and never takes pointer
 * events — the app stays clickable straight through the reveal.
 */
export function ModeCast() {
  const announcement = useModeAnnouncement();
  if (!announcement) return null;

  /* Keyed by id so a switch made mid-reveal restarts the whole thing from
     frame one instead of resuming a half-played animation. */
  return <ModeCastFrame key={announcement.id} id={announcement.id} mode={announcement.mode} />;
}

function ModeCastFrame({ id, mode }: { id: number; mode: PrismMode }) {
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (reduced) {
      const cleared = window.setTimeout(() => retireAnnouncement(id), CAST_STILL_MS);
      return () => window.clearTimeout(cleared);
    }

    const leaves = window.setTimeout(() => setLeaving(true), CAST_IN_MS);
    const cleared = window.setTimeout(() => retireAnnouncement(id), CAST_IN_MS + CAST_OUT_MS);
    return () => {
      window.clearTimeout(leaves);
      window.clearTimeout(cleared);
    };
  }, [id, reduced]);

  const art = ART[mode];
  const deployments = deploymentsForMode(mode);
  const scope = deployments.map((deployment) => `${deployment.solverName} on ${deployment.chainName}`);

  return (
    <div
      className="prism-cast"
      data-phase={reduced ? "still" : leaving ? "out" : "in"}
      role="status"
      aria-live="polite"
      style={
        {
          "--cast-key": art.key,
          "--cast-key-2": art.key2,
          "--cast-strip": castStrip(art),
        } as CSSProperties
      }
    >
      <p className="sr-only">{`${art.label} market scope. Trading ${scope.join(" and ")}.`}</p>

      <span aria-hidden className="prism-cast__scrim" />
      <span aria-hidden className="prism-cast__beam" />
      <span aria-hidden className="prism-cast__edge" />

      <div aria-hidden className="prism-cast__stage">
        <span className="prism-cast__halo" />

        <span className="prism-cast__shards">
          {SHARDS.map((shard, index) => (
            <span
              key={index}
              className="prism-cast__shard"
              style={
                {
                  "--r": `${shard.rotate}deg`,
                  "--w": shard.length,
                  "--from": `${shard.dir * 3}vw`,
                  "--to": `${shard.dir * shard.travel}vw`,
                  "--sd": `${shard.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>

        <p className="prism-cast__kicker">
          <span className="prism-cast__tick" />
          Market scope
          <span className="prism-cast__tick" />
        </p>

        <span className="prism-cast__rule prism-cast__rule--top" />

        {/* Two identical glyph rows: the extruded face, and a sheen that is
            clipped to the same glyphs. Duplicating the markup — rather than
            overlaying one text run on a row of spans — is what guarantees the
            two layers stay registered to the pixel while the letters land. */}
        <div className="prism-cast__word">
          <span className="prism-cast__layer prism-cast__layer--face">{letterRow(art.word)}</span>
          <span className="prism-cast__layer prism-cast__layer--sheen">{letterRow(art.word)}</span>
        </div>

        <span className="prism-cast__rule prism-cast__rule--bottom" />

        <p className="prism-cast__scope">
          {deployments.map((deployment) => (
            <span key={deployment.family} className="prism-cast__venue">
              <span
                className="prism-cast__chain"
                style={{ "--chain": `var(${deployment.chainColorVar})` } as CSSProperties}
              />
              {deployment.solverName}
              <span className="prism-cast__sep">·</span>
              {deployment.chainName}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

/**
 * One span per glyph, each carrying its stagger index.
 *
 * `data-char` feeds the extruded slab drawn by the face layer's `::before`,
 * so the depth copy never falls out of sync with the letter it belongs to.
 */
function letterRow(word: string) {
  return [...word].map((char, index) => (
    <span key={index} className="prism-cast__letter" data-char={char} style={{ "--i": String(index) } as CSSProperties}>
      {char}
    </span>
  ));
}
