import type { Transition, Variants } from "motion/react";

/**
 * The house easing — a long, settled ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`)
 * shared with `apps/web`. Reveals decelerate into place; nothing bounces. Typed
 * as a mutable bezier tuple so `motion` accepts it directly as `transition.ease`.
 */
export const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Standard entrance transition for a single revealed element. */
export const revealTransition: Transition = {
  duration: 0.7,
  ease: easeOut,
};

/** Fade-and-rise, the default reveal for headings, copy, and standalone cards. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

/** A gentler fade with no travel — for large surfaces where motion should be quiet. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: easeOut } },
};

/**
 * Container that releases its {@link staggerItem} children one after another.
 * Pair with a `whileInView` trigger so a grid assembles as it scrolls in.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

/** A single item inside a {@link staggerContainer}. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

/** Shared `whileInView` viewport config — fire once, a little before fully in view. */
export const inViewOnce = { once: true, margin: "-80px" } as const;
