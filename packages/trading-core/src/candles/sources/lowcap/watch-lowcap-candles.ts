import type { SolverId } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { EnigmaPriceTick } from "../../../websocket/prices/types";
import { watchEnigmaPrices } from "../../../websocket/prices/watch-enigma-prices";
import type { Candle, GetCandlesReturnType, WatchCandlesParameters } from "../../types";
import { floorLowcapCandleTime, shiftLowcapCandleTime } from "./lowcap-candle-time";

interface Parameters extends WatchCandlesParameters {
  chainId?: number;
  solverId?: SolverId;
  includeFlat: boolean;
  refreshIntervalMs: number;
  resolveAddress: (signal: AbortSignal) => Promise<string>;
  getHistory: (
    address: string,
    range: { from: number; to: number; signal: AbortSignal },
  ) => Promise<GetCandlesReturnType>;
}

function equalCandle(a: Candle | undefined, b: Candle | undefined): boolean {
  return (
    a?.time === b?.time &&
    a?.open === b?.open &&
    a?.high === b?.high &&
    a?.low === b?.low &&
    a?.close === b?.close &&
    a?.volume === b?.volume
  );
}

/** Seed from OHLCV, apply timestamped price ticks, and reconcile without caching final history. @internal */
export function watchLowcapCandles(config: Config, parameters: Parameters): () => void {
  const { marketName, resolution, onCandle, onReset, onError, refreshIntervalMs } = parameters;
  let active = true;
  let opened = false;
  let address: string | undefined;
  let current: Candle | undefined;
  let lastTickTime = -Infinity;
  let lastReceivedTickTime = -Infinity;
  let lastEmittedTime = -Infinity;
  const emittedHistory = new Map<number, Candle>();
  let previousClose: number | undefined;
  let seeded = false;
  let pending: EnigmaPriceTick[] = [];
  let previousHistory: Candle[] = [];
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastReset = Date.now();

  function report(error: unknown) {
    if (!active) return;
    onError?.(
      error instanceof SymmError
        ? error
        : new SymmError("api", "LOWCAP_CANDLE_STREAM_ERROR", error instanceof Error ? error.message : String(error)),
    );
  }

  function emit(candle: Candle, closed = false) {
    if (!active || candle.time < lastEmittedTime) return;
    if (
      !parameters.includeFlat &&
      previousClose !== undefined &&
      candle.volume === 0 &&
      [candle.open, candle.high, candle.low, candle.close].every((price) => price === previousClose)
    )
      return;
    lastEmittedTime = candle.time;
    emittedHistory.set(candle.time, { ...candle });
    const oldest = emittedHistory.keys().next().value;
    if (emittedHistory.size > 2 && oldest !== undefined) emittedHistory.delete(oldest);
    onCandle({ ...candle }, { closed });
  }

  function applyTick(tick: EnigmaPriceTick) {
    if (tick.name !== marketName || (tick.address && tick.address !== address)) return;
    const price = Number(tick.markPrice);
    const time = tick.time;
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      time === undefined ||
      !Number.isSafeInteger(time) ||
      time < lastTickTime
    )
      return;
    const start = floorLowcapCandleTime(time, resolution);
    if (current && start < current.time) return;
    lastTickTime = time;
    if (!current || start > current.time) {
      if (current) {
        emit(current, true);
        previousClose = current.close;
      }
      current = { time: start, open: price, high: price, low: price, close: price, volume: 0 };
    } else {
      current = { ...current, high: Math.max(current.high, price), low: Math.min(current.low, price), close: price };
    }
    emit(current);
  }

  async function refresh() {
    if (!active || controller) return;
    const request = new AbortController();
    controller = request;
    const tickTimeAtStart = lastReceivedTickTime;
    pending = [];
    try {
      address ??= await parameters.resolveAddress(request.signal);
      if (!active || request.signal.aborted) return;
      const now = Date.now();
      const from = shiftLowcapCandleTime(floorLowcapCandleTime(now, resolution), resolution, -1);
      const result = await parameters.getHistory(address, { from, to: now + 1, signal: request.signal });
      if (!active || request.signal.aborted) return;
      const history = result.candles;
      const removedCurrent =
        previousHistory.some((bar) => bar.time === lastEmittedTime && bar.time >= from) &&
        !history.some((bar) => bar.time === lastEmittedTime);
      const times = new Set([...previousHistory, ...history].map((candle) => candle.time));
      const corrected = [...times].filter(
        (time) =>
          time >= from &&
          time < lastEmittedTime &&
          !equalCandle(
            emittedHistory.get(time) ?? previousHistory.find((bar) => bar.time === time),
            history.find((bar) => bar.time === time),
          ),
      );
      if (removedCurrent) corrected.push(lastEmittedTime);
      /** Unknown historical backfills still require a full hourly reconciliation. */
      if (seeded && now - lastReset >= 3_600_000) {
        lastReset = now;
        onReset?.();
      } else if (seeded && corrected.length > 0) {
        onReset?.({
          from: Math.min(...corrected),
          to: shiftLowcapCandleTime(Math.max(...corrected), resolution, 1),
        });
      }
      previousHistory = history;
      /** A reset replaces these snapshots; do not report the same correction again. */
      for (const time of emittedHistory.keys()) {
        if (time < from || time >= lastEmittedTime) continue;
        const snapshot = history.find((bar) => bar.time === time);
        if (snapshot) emittedHistory.set(time, snapshot);
        else emittedHistory.delete(time);
      }
      if (removedCurrent) current = undefined;
      const latest = history.at(-1);
      if (latest && (!current || latest.time >= current.time)) {
        if (current && latest.time > current.time) {
          emit(history.find((bar) => bar.time === current?.time) ?? current, true);
        }
        current = { ...latest };
        previousClose = history.at(-2)?.close;
        emit(current, shiftLowcapCandleTime(current.time, resolution, 1) <= lastReceivedTickTime);
      }
      seeded = true;
      const buffered = pending;
      pending = [];
      /** Compare service timestamps with other service timestamps, never the client's clock. */
      lastTickTime = Math.max(tickTimeAtStart, latest?.time ?? -Infinity);
      for (const tick of buffered) {
        if (tick.time !== undefined && tick.time >= tickTimeAtStart) applyTick(tick);
      }
    } catch (error) {
      if (!request.signal.aborted) {
        if (seeded) pending = [];
        report(error);
      }
    } finally {
      if (controller === request) {
        controller = undefined;
        if (active)
          timer = setTimeout(() => {
            void refresh();
          }, refreshIntervalMs);
      }
    }
  }

  const unwatch = watchEnigmaPrices(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
    names: [marketName],
    onPrices(ticks) {
      if (!active) return;
      for (const tick of ticks) {
        if (tick.name !== marketName || (address && tick.address && tick.address !== address)) continue;
        const price = Number(tick.markPrice);
        if (
          tick.time === undefined ||
          !Number.isSafeInteger(tick.time) ||
          !Number.isFinite(price) ||
          price <= 0 ||
          tick.time < lastReceivedTickTime
        )
          continue;
        lastReceivedTickTime = tick.time;
        if (controller || !seeded) {
          // Bounded buffering while HTTP is in flight. If it overflows, reseed
          // from HTTP rather than constructing an OHLC bar from incomplete ticks.
          if (pending.length >= 1_000) {
            pending = [];
            seeded = false;
            current = undefined;
            controller?.abort();
            controller = undefined;
            clearTimeout(timer);
            onReset?.();
            void refresh();
          }
          pending.push(tick);
        }
        if (seeded) applyTick(tick);
      }
    },
    onStatusChange(status) {
      if (!active) return;
      parameters.onStatusChange?.(status);
      if (status === "open") {
        if (opened) {
          controller?.abort();
          controller = undefined;
          clearTimeout(timer);
          pending = [];
          seeded = false;
          current = undefined;
          previousHistory = [];
          emittedHistory.clear();
          lastTickTime = -Infinity;
          lastReceivedTickTime = -Infinity;
          onReset?.();
          void refresh();
        }
        opened = true;
      }
    },
    onError: report,
  });
  void refresh();

  return () => {
    active = false;
    clearTimeout(timer);
    controller?.abort();
    pending = [];
    unwatch();
  };
}
