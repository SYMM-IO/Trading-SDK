import type { ITimeScaleApi, LogicalRange, Time } from "lightweight-charts";

interface Options {
  container: HTMLElement;
  timeScale: ITimeScaleApi<Time>;
  hasData: () => boolean;
  onLoadOlder: () => void;
}

/** Connect chart gestures to bounded history requests; data updates never start a search. */
export function watchCandleChartNavigation({ container, timeScale, hasData, onLoadOlder }: Options) {
  let gesture: { from: number | null } | null = null;
  let pointerStart: number | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;

  function reset() {
    gesture = null;
    pointerStart = null;
    clearTimeout(wheelTimer);
  }

  function beginGesture() {
    clearTimeout(wheelTimer);
    gesture = { from: timeScale.getVisibleLogicalRange()?.from ?? null };
  }

  function requestOlder() {
    if (!gesture) return;
    gesture = null;
    onLoadOlder();
  }

  function onVisibleRange(range: LogicalRange | null) {
    if (!gesture || !range || range.from >= 50) return;
    if (gesture.from !== null && range.from >= gesture.from - 0.5) return;
    requestOlder();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || event.isPrimary === false) return;
    beginGesture();
    pointerStart = event.clientX;
  }

  function onPointerMove(event: PointerEvent) {
    // An empty series has no logical range to scroll. A deliberate rightward
    // drag can still request the preceding window without inventing candles.
    if (pointerStart !== null && event.clientX - pointerStart > 24 && !hasData()) requestOlder();
  }

  function onPointerUp() {
    if (pointerStart === null) return;
    onVisibleRange(timeScale.getVisibleLogicalRange());
    reset();
  }

  function onWheel(event: WheelEvent) {
    beginGesture();
    if (!hasData() && (event.deltaY > 0 || event.deltaX < 0)) requestOlder();
    // The library applies wheel changes after its input handler. Check once
    // more when the gesture settles, then disarm before unrelated resizes.
    wheelTimer = setTimeout(() => {
      onVisibleRange(timeScale.getVisibleLogicalRange());
      reset();
    }, 150);
  }

  container.addEventListener("pointerdown", onPointerDown, true);
  container.addEventListener("pointermove", onPointerMove, true);
  container.addEventListener("wheel", onWheel, { capture: true, passive: true });
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", reset, true);
  timeScale.subscribeVisibleLogicalRangeChange(onVisibleRange);

  return {
    reset,
    dispose() {
      reset();
      container.removeEventListener("pointerdown", onPointerDown, true);
      container.removeEventListener("pointermove", onPointerMove, true);
      container.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", reset, true);
      timeScale.unsubscribeVisibleLogicalRangeChange(onVisibleRange);
    },
  };
}
