import type { Config } from "../core/config";
import { gaslessAbortedError, gaslessSleep } from "./abortable-sleep";
import type { GaslessHttpContext } from "./http";

/**
 * Sustained status GETs per second, per deployment.
 *
 * The anonymous gateway allows 10 requests/s per IP and protocol instance, and
 * status polling is the one gasless call that runs unattended and in parallel —
 * one loop per in-flight workflow, plus every mounted `useGaslessRequest`. This
 * keeps the whole page's polling inside a predictable share of that budget so a
 * submit, a fee quote or a deposit-policy read is never the call that earns the
 * `429`.
 *
 * @internal
 */
export const GASLESS_STATUS_READ_RATE_PER_SECOND = 4;

/**
 * How many status reads may start back-to-back after an idle period. Matching
 * the rate keeps a freshly opened page responsive — four workflows resolve
 * their first poll immediately — without letting a burst outrun the sustained
 * rate afterwards.
 *
 * @internal
 */
export const GASLESS_STATUS_READ_BURST = 4;

/** Minimum spacing between two sustained reads, in ms. */
const MIN_SPACING_MS = 1_000 / GASLESS_STATUS_READ_RATE_PER_SECOND;

/**
 * One deployment's schedule: the earliest time the next read may start. A read
 * reserves its slot by moving the mark forward, so concurrent callers queue in
 * arrival order instead of racing for the same instant.
 */
interface ReadSchedule {
  nextStartAt: number;
}

const schedules = new WeakMap<Config, Map<string, ReadSchedule>>();

/**
 * The bucket a context shares its budget with: the gateway limits per IP and
 * protocol instance, so both services of one deployment draw from one bucket
 * while a second deployment (a different origin or instance) gets its own.
 */
function scheduleKey(context: GaslessHttpContext): string {
  let origin: string;
  try {
    origin = new URL(context.baseURL).origin;
  } catch {
    origin = context.baseURL;
  }
  return `${origin}|${context.protocolInstance ?? ""}`;
}

function getSchedule(config: Config, key: string): ReadSchedule {
  let byDeployment = schedules.get(config);
  if (!byDeployment) {
    byDeployment = new Map();
    schedules.set(config, byDeployment);
  }
  let schedule = byDeployment.get(key);
  if (!schedule) {
    schedule = { nextStartAt: 0 };
    byDeployment.set(key, schedule);
  }
  return schedule;
}

/**
 * Wait for this deployment's next status-read slot.
 *
 * Paces status GETs at {@link GASLESS_STATUS_READ_RATE_PER_SECOND} per second
 * with a {@link GASLESS_STATUS_READ_BURST} burst, per `(config, origin +
 * protocol instance)`. It only ever delays a read — it never drops one, and a
 * caller that aborts releases nothing, because a slot that was never used stays
 * in the past and is handed to the next caller immediately.
 *
 * @param config - The SDK config the read runs under.
 * @param context - The resolved HTTP context (its origin and instance pick the bucket).
 * @param options - Abort signal for the wait.
 * @throws {SymmError} `GASLESS_WAIT_ABORTED` when `options.signal` aborts while queued.
 *
 * @internal
 */
export async function acquireGaslessStatusRead(
  config: Config,
  context: GaslessHttpContext,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  if (options.signal?.aborted) throw gaslessAbortedError("the status read");

  const schedule = getSchedule(config, scheduleKey(context));
  const now = Date.now();
  /** An idle bucket refills up to the burst, so the mark never rewinds further than that. */
  const earliest = now - (GASLESS_STATUS_READ_BURST - 1) * MIN_SPACING_MS;
  const startAt = Math.max(schedule.nextStartAt, earliest);
  schedule.nextStartAt = startAt + MIN_SPACING_MS;

  const delay = startAt - now;
  if (delay <= 0) return;
  await gaslessSleep(delay, options.signal, "the status read");
}
