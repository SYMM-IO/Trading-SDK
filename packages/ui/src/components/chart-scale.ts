/**
 * Pure layout math shared by the chart components. No DOM, no React — every
 * function here is a plain mapping from data to pixels so it can be unit-tested
 * without rendering.
 */

/** A linear mapping from a data domain onto a pixel range. */
export interface LinearScale {
  (value: number): number;
  domain: readonly [number, number];
  range: readonly [number, number];
}

/**
 * Build a linear scale. A degenerate domain (`min === max`) maps everything onto
 * the start of the range rather than dividing by zero.
 *
 * @param domain - `[min, max]` in data units.
 * @param range - `[start, end]` in pixels; `start > end` flips the axis (y grows downward in SVG).
 */
export function linearScale(domain: readonly [number, number], range: readonly [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const scale = ((value: number) => (span === 0 ? r0 : r0 + ((value - d0) / span) * (r1 - r0))) as LinearScale;
  scale.domain = domain;
  scale.range = range;
  return scale;
}

/**
 * Round `max` up to the next "nice" number and split `[0, niceMax]` into clean
 * tick values (`1 / 2 / 5 × 10^k` steps), so the axis reads `0 / 500 / 1,000`
 * instead of `0 / 337.4 / 674.8`.
 *
 * Always starts at zero: every chart here plots a magnitude that grows from a
 * baseline, so the axis must show where that baseline is. A non-positive `max`
 * yields a single `[0, 1]` step so an all-zero series still draws an axis.
 *
 * @param max - The largest value plotted.
 * @param count - Target tick count (the result may have one more or fewer).
 * @returns Ascending tick values from `0` to the nice maximum, inclusive.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];

  const rawStep = max / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  /** Round to the nearest nice step (not up), so a target of 4 ticks lands near 4. */
  const factor = residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10;
  const step = factor * magnitude;

  const ticks: number[] = [];
  const top = Math.ceil(max / step) * step;
  /** Walk by integer multiples to avoid accumulating float drift in `0.1 + 0.2` territory. */
  for (let i = 0; i * step <= top + step * 1e-9; i += 1) ticks.push(Number((i * step).toPrecision(12)));
  return ticks;
}

/**
 * Choose which of `n` evenly-spaced x positions get an axis label, given how
 * many labels fit. Always includes the first and the last position, and spaces
 * the rest as evenly as integer indices allow.
 *
 * @param n - Number of data positions.
 * @param maxLabels - How many labels there is room for (`>= 2`).
 * @returns Ascending indices to label.
 */
export function pickTickIndices(n: number, maxLabels: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const slots = Math.max(2, Math.min(n, Math.floor(maxLabels)));
  const indices = new Set<number>();
  for (let i = 0; i < slots; i += 1) indices.add(Math.round((i * (n - 1)) / (slots - 1)));
  return [...indices].sort((a, b) => a - b);
}

/**
 * Index of the data position nearest to a pixel x, for crosshair snapping.
 *
 * @param positions - Ascending pixel x of every data position.
 * @param x - The pointer's x in the same pixel space.
 * @returns The nearest index, or `-1` when there are no positions.
 */
export function nearestIndex(positions: readonly number[], x: number): number {
  if (positions.length === 0) return -1;
  let lo = 0;
  let hi = positions.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (positions[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(positions[lo - 1]! - x) <= Math.abs(positions[lo]! - x)) return lo - 1;
  return lo;
}

/**
 * Cumulative offsets for a stacked bar: `[start, end]` per segment, in data
 * units, skipping non-positive segments so a zero never claims a gap.
 *
 * @param values - One value per series, in series order (bottom first).
 * @returns One `[start, end]` per input value; empty segments get `[start, start]`.
 */
export function stackSegments(values: readonly number[]): Array<readonly [number, number]> {
  let running = 0;
  return values.map((value) => {
    if (!(value > 0)) return [running, running] as const;
    const start = running;
    running += value;
    return [start, running] as const;
  });
}

/**
 * SVG path for a rectangle whose **top** corners are rounded and whose bottom
 * corners are square — the "4px rounded data-end, square at the baseline" bar.
 * The radius shrinks to fit a bar shorter or narrower than `2r`.
 */
export function roundedTopRect(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  if (width <= 0 || height <= 0) return "";
  const right = x + width;
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${right - r}`,
    `Q${right},${y} ${right},${y + r}`,
    `V${bottom}`,
    "Z",
  ].join("");
}
