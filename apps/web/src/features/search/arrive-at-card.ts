/** How long to wait for a card that a navigation is still rendering. */
const FIND_TIMEOUT_MS = 8000;

/** How long to hold the card in place while content above it is still loading. */
const HOLD_MS = 2500;

/** Longest a smooth scroll is given to finish before the hold takes over. */
const SMOOTH_SCROLL_MS = 900;

/** Drift, in pixels, past which a settling layout re-pins the card. */
const DRIFT_TOLERANCE_PX = 4;

/**
 * Upper bound for the arrival mark. The CSS animation (`card-arrival` in
 * `globals.css`) clears it on `animationend`; this fallback clears it when
 * reduced motion turns the animation off.
 */
const ARRIVAL_MARK_MS = 2200;

/** Delay before taking focus, so the closing palette has released its focus trap. */
const FOCUS_DELAY_MS = 260;

/** Any of these from the reader means they have taken over the scroll position. */
const READER_INPUT_EVENTS = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

/** Options for {@link arriveAtCard}. */
export interface ArriveAtCardOptions {
  /**
   * `smooth` glides from the current position, which keeps a jump within one page
   * legible; `instant` lands directly, for a new page. Reduced motion always lands
   * instantly.
   */
  motion: "smooth" | "instant";
  /**
   * The pathname the card lives on. The card is only accepted once the browser is
   * on it, so a card with the same id on the page being left is never mistaken
   * for the destination.
   */
  pathname: string;
}

/**
 * Land on the card whose DOM id is `id`: wait for it to render, scroll it to just
 * below the fixed header (its `scroll-mt-*` margin), hand it keyboard focus, and
 * play the one-shot arrival mark (`data-arrived`). Content above the card that is
 * still loading would push it off-screen, so the card is held in place until the
 * layout settles or the reader scrolls on their own.
 *
 * Only a design-system card (`[data-slot="card"]`) is treated as a destination;
 * any other element with that id is left to the browser.
 *
 * @param id - The card's DOM id — its `testId`.
 * @param options - How to move there, and on which page the card lives.
 * @returns A cancel function that stops waiting for the card and releases the hold.
 */
export function arriveAtCard(id: string, options: ArriveAtCardOptions): () => void {
  const cleanups: (() => void)[] = [];
  let cancelled = false;

  cleanups.push(
    waitForCard(id, options.pathname, (card) => {
      if (!cancelled) land(card, options.motion, cleanups);
    }),
  );

  return () => {
    cancelled = true;
    for (const cleanup of cleanups.splice(0)) cleanup();
  };
}

/** Call `onFound` with the card once it is rendered on `pathname`, or give up after {@link FIND_TIMEOUT_MS}. */
function waitForCard(id: string, pathname: string, onFound: (card: HTMLElement) => void): () => void {
  /**
   * Looked up as a card, not by id alone: a page can reuse a card's id on another
   * element — the Pools page's pool picker shares `pool-detail` with its card —
   * and `getElementById` would return whichever comes first.
   */
  function find(): HTMLElement | null {
    if (window.location.pathname !== pathname) return null;
    return document.querySelector<HTMLElement>(`[data-slot="card"]#${CSS.escape(id)}`);
  }

  const existing = find();
  if (existing) {
    onFound(existing);
    return () => {};
  }

  const observer = new MutationObserver(() => {
    const card = find();
    if (card) {
      stop();
      onFound(card);
    }
  });
  const timeout = window.setTimeout(stop, FIND_TIMEOUT_MS);

  function stop() {
    observer.disconnect();
    window.clearTimeout(timeout);
  }

  observer.observe(document.body, { childList: true, subtree: true });
  return stop;
}

/** Scroll to the card, mark it, focus it, and hold it in place while the page settles. */
function land(card: HTMLElement, motion: ArriveAtCardOptions["motion"], cleanups: (() => void)[]) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = motion === "smooth" && !reduceMotion ? "smooth" : "instant";

  card.scrollIntoView({ behavior, block: "start" });
  markArrival(card);
  cleanups.push(focusWhenFree(card));
  cleanups.push(holdInPlace(card, behavior === "smooth"));
}

/** Restart the card's one-shot arrival animation, then clear the mark when it ends. */
function markArrival(card: HTMLElement) {
  card.removeAttribute("data-arrived");
  /** Reading layout between the two writes restarts the animation on a repeat visit. */
  void card.offsetWidth;
  card.setAttribute("data-arrived", "");

  function clear() {
    card.removeAttribute("data-arrived");
    card.removeEventListener("animationend", onAnimationEnd);
    window.clearTimeout(fallback);
  }

  function onAnimationEnd(event: AnimationEvent) {
    /** Children's own animations bubble here too; only the card's mark ends it. */
    if (event.target === card && event.animationName === "card-arrival") clear();
  }

  card.addEventListener("animationend", onAnimationEnd);
  const fallback = window.setTimeout(clear, ARRIVAL_MARK_MS);
}

/**
 * Move keyboard focus to the card once the palette has closed, so the next Tab
 * continues inside it. Skipped if the reader has already focused something else.
 * A card is not focusable on its own, so it is made focusable for this one visit.
 */
function focusWhenFree(card: HTMLElement): () => void {
  const timer = window.setTimeout(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;

    if (!card.hasAttribute("tabindex")) {
      card.setAttribute("tabindex", "-1");
      card.addEventListener("blur", () => card.removeAttribute("tabindex"), { once: true });
    }
    card.focus({ preventScroll: true });
  }, FOCUS_DELAY_MS);

  return () => window.clearTimeout(timer);
}

/**
 * Keep the card where it landed while the page above it is still growing — data
 * loading into earlier cards would otherwise push it down and out of view. Lets
 * go after {@link HOLD_MS}, or the moment the reader scrolls, taps or types.
 */
function holdInPlace(card: HTMLElement, afterSmoothScroll: boolean): () => void {
  const restingTop = parseFloat(getComputedStyle(card).scrollMarginTop) || 0;
  const observer = new ResizeObserver(() => {
    const drift = card.getBoundingClientRect().top - restingTop;
    if (Math.abs(drift) > DRIFT_TOLERANCE_PX) window.scrollBy({ top: drift, behavior: "instant" });
  });
  let startTimer: number | undefined;
  let stopTimer: number | undefined;

  function start() {
    window.removeEventListener("scrollend", start);
    window.clearTimeout(startTimer);
    observer.observe(document.body);
    stopTimer = window.setTimeout(release, HOLD_MS);
  }

  function release() {
    observer.disconnect();
    window.removeEventListener("scrollend", start);
    window.clearTimeout(startTimer);
    window.clearTimeout(stopTimer);
    for (const type of READER_INPUT_EVENTS) window.removeEventListener(type, release);
  }

  /** Listening from the first moment, so scrolling mid-glide is never undone when the glide ends. */
  for (const type of READER_INPUT_EVENTS) window.addEventListener(type, release, { passive: true });

  if (afterSmoothScroll) {
    /** A smooth scroll must finish first — re-pinning mid-glide would cut it short. */
    window.addEventListener("scrollend", start, { once: true });
    startTimer = window.setTimeout(start, SMOOTH_SCROLL_MS);
  } else {
    start();
  }

  return release;
}
