"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** Ember-family confetti colors — coral core, warm highlights, a violet accent. */
const CONFETTI_COLORS = ["#F0553A", "#FF7A5C", "#FFC7B4", "#8B7BF0", "#FFFFFF"];

/** School-pride stream colors — the coral family so the side jets read as Symmio. */
const STREAM_COLORS = ["#F0553A", "#FF7A5C", "#FFC7B4", "#8B7BF0"];

/**
 * The Symmio brand mark as one compound path (the logo's three shapes unioned).
 * Rendered by `shapeFromPath` as a single-color silhouette, so it takes whichever
 * coral the burst assigns.
 */
const SYMMIO_LOGO_PATH =
  "M0 498.172V633H712.968V576.873C712.968 484.621 787.75 409.836 880 409.836V223.866H694.408V493.522L0 498.172Z M880 134.828V0H167.032V56.127C167.032 148.379 92.2495 223.164 0 223.164V409.134H185.592V139.478L880 134.828Z M270.175 223.866H609.825V409.134H270.175V223.866Z";

/** A solid heart drawn as a filled path, so it takes the coral confetti color. */
const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

/**
 * Continuous "School Pride" streams — two low, angled jets from the lower-left
 * and lower-right corners — that run for as long as the success screen is shown.
 *
 * @returns A stop function that halts the animation-frame loop.
 */
function startSchoolPride(): () => void {
  let running = true;

  const frame = () => {
    if (!running) return;
    const stream = {
      particleCount: 2,
      spread: 55,
      startVelocity: 55,
      colors: STREAM_COLORS,
      disableForReducedMotion: true,
    } as const;
    confetti({ ...stream, angle: 60, origin: { x: 0 } });
    confetti({ ...stream, angle: 120, origin: { x: 1 } });
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
  return () => {
    running = false;
  };
}

/**
 * Rain a burst of Symmio logos and hearts straight down from the top edge. The
 * larger `scalar` keeps the custom shapes legible as they fall across the width.
 */
function fireShapeBurst(shapes: confetti.Shape[]) {
  confetti({
    shapes,
    particleCount: 26,
    angle: 270,
    spread: 120,
    startVelocity: 34,
    gravity: 0.9,
    ticks: 240,
    scalar: 2.2,
    origin: { x: 0.5, y: 0 },
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
  });
}

/** Random float in `[min, max)`. */
function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * A light "Fireworks" show for small screens: modest bursts pop at random points
 * inside the viewport on a slow interval, so a phone or tablet gets a celebratory
 * fill without the per-frame streams and shape bursts that would tax it. Small
 * `scalar` and short `ticks` keep each pop cheap and self-clearing.
 *
 * @returns A stop function that clears the interval.
 */
function startFireworks(): () => void {
  const defaults = {
    startVelocity: 26,
    spread: 360,
    ticks: 50,
    scalar: 0.9,
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
  } as const;

  const fire = () => {
    confetti({ ...defaults, particleCount: 28, origin: { x: randomInRange(0.2, 0.8), y: randomInRange(0.25, 0.5) } });
  };

  fire();
  const id = setInterval(fire, 1100);
  return () => clearInterval(id);
}

/**
 * The celebration that plays while a confirmed registration is on screen. Three
 * expanding coral light rings bloom out on entry regardless of size. The confetti
 * then adapts to the viewport: tablets and phones (≤ 1024px) get a single light
 * Fireworks show that fits the screen without taxing the device, while desktop
 * gets continuous School Pride streams from both lower corners plus a Symmio-logo
 * and heart shape burst from the top every five seconds. Runs for as long as the
 * success screen is mounted and is fully skipped under `prefers-reduced-motion`.
 */
export function Celebration() {
  const reduceMotion = useReducedMotion();
  const [rings, setRings] = useState(!reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;

    const done = setTimeout(() => setRings(false), 1600);

    /** Tablet and mobile widths: one lightweight fireworks show, nothing per frame. */
    if (window.matchMedia("(max-width: 1024px)").matches) {
      const stopFireworks = startFireworks();
      return () => {
        stopFireworks();
        clearTimeout(done);
      };
    }

    /** Desktop: continuous School Pride streams plus a logo/heart burst every 5s. */
    const shapes = [confetti.shapeFromPath({ path: SYMMIO_LOGO_PATH }), confetti.shapeFromPath({ path: HEART_PATH })];
    const stopPride = startSchoolPride();
    fireShapeBurst(shapes);
    const burst = setInterval(() => fireShapeBurst(shapes), 5000);

    return () => {
      stopPride();
      clearInterval(burst);
      clearTimeout(done);
    };
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      <AnimatePresence>
        {rings
          ? [0, 0.18, 0.36].map((delay, index) => (
              <motion.span
                key={index}
                className="border-primary/40 absolute rounded-full border"
                style={{ width: 120, height: 120 }}
                initial={{ scale: 0.2, opacity: 0.6 }}
                animate={{ scale: 9, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, delay, ease: [0.16, 1, 0.3, 1] }}
              />
            ))
          : null}
      </AnimatePresence>
    </div>
  );
}
