import type { GaslessWriteOptions, GaslessWriteParameter } from "../../shared/types/properties";

/**
 * When each user action started, keyed by the `gasless` options object an
 * action hands to the write it builds. A `WeakMap` keeps the start time out of
 * the public options type and lets it die with the object.
 */
const attemptStarts = new WeakMap<GaslessWriteOptions, number>();

/**
 * Date a write's gasless signature from the moment the user's action started.
 *
 * An action that reads before it writes (a Muon signature, a quote, the
 * account's isolation type) calls this on its first line and passes the result
 * down as the write's `gasless`. The signature deadline is then counted from
 * this moment, not from when the write is finally signed, so the bound in
 * `GASLESS_SIGNATURE_LIFETIME_SECONDS` holds from the caller's point of view.
 *
 * The caller's object is never mutated: the result is a copy that relays
 * exactly as the input would. Input that already carries a start time is
 * returned unchanged, so the outermost action's start wins.
 *
 * @param gasless - The action's `gasless` parameter, verbatim.
 * @param startedAtMs - The action's start, in ms since epoch.
 * @returns The options to pass to the write.
 *
 * @internal
 */
export function withGaslessAttemptStart(
  gasless: GaslessWriteParameter["gasless"],
  startedAtMs = Date.now(),
): GaslessWriteOptions {
  if (typeof gasless === "object" && attemptStarts.has(gasless)) return gasless;
  const options: GaslessWriteOptions = typeof gasless === "boolean" ? { enabled: gasless } : { ...gasless };
  attemptStarts.set(options, startedAtMs);
  return options;
}

/**
 * The start time {@link withGaslessAttemptStart} recorded for these options.
 *
 * @param gasless - A write's `gasless` parameter.
 * @returns The action's start in ms since epoch, or `undefined` when no action recorded one.
 *
 * @internal
 */
export function getGaslessAttemptStart(gasless: GaslessWriteParameter["gasless"]): number | undefined {
  return typeof gasless === "object" ? attemptStarts.get(gasless) : undefined;
}
