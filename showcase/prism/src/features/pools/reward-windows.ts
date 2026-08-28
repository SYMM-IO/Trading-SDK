/**
 * The trailing windows the reward figures offer.
 *
 * Not a design preference: the listing backend caps `days` at **1–30** on both
 * the per-pool total and the per-wallet total, and answers a `422` outside it —
 * so a "90 days" or "all time" cell would be a button that only ever errors. 30
 * is the ceiling, and the default, because it is the most complete answer the
 * endpoints can give.
 */
export const REWARD_WINDOW_DAYS = [7, 14, 30] as const;

/** A window the reward endpoints accept, in days. */
export type RewardWindowDays = (typeof REWARD_WINDOW_DAYS)[number];

/** The widest window the service allows, and what every reward figure opens on. */
export const DEFAULT_REWARD_WINDOW_DAYS: RewardWindowDays = 30;

/** How a window is written on a control. */
export function rewardWindowLabel(days: RewardWindowDays): string {
  return `${days}D`;
}

/** Every window's label, in order — the option list the controls render. */
export const REWARD_WINDOW_LABELS: readonly string[] = REWARD_WINDOW_DAYS.map(rewardWindowLabel);

/**
 * A label back to the window it names.
 *
 * Both controls hand a string back — `Chips` has nothing but labels, and
 * `Segmented` keys its cells by one — so the round trip belongs beside the
 * labels rather than being re-derived at each call site. Anything not on the
 * list answers `undefined`, which a caller ignores rather than guessing a
 * window the service would reject.
 */
export function rewardWindowFromLabel(label: string): RewardWindowDays | undefined {
  return REWARD_WINDOW_DAYS.find((days) => rewardWindowLabel(days) === label);
}
