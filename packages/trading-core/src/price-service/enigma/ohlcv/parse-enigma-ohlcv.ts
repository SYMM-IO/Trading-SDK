import type { Candle } from "../../../candles/types";
import { SymmError } from "../../../shared/errors/symm-error";

/** A history window and the backend's optional continuation signal. @internal */
export interface EnigmaOhlcvPage {
  candles: Candle[];
  /** Missing on deployments that cannot yet report history exhaustion. */
  hasOlder?: boolean;
}

/** Validate candle data and preserve a continuation signal when available. @internal */
export function parseEnigmaOhlcvPage(data: unknown): EnigmaOhlcvPage {
  const candles = parseEnigmaOhlcv(data);
  const hasOlder = (data as Record<string, unknown>).hasOlder;
  if (hasOlder !== undefined && typeof hasOlder !== "boolean") {
    throw new SymmError("api", "INVALID_ENIGMA_OHLCV_RESPONSE", "OHLCV hasOlder must be a boolean when present.");
  }
  return hasOlder === undefined ? { candles } : { candles, hasOlder };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Validate one OHLCV response and convert candle starts from seconds to ms.
 * Prices and USD quote volume are preserved; gaps remain gaps.
 *
 * @param data - Untrusted response body.
 * @returns Candles in the service's strictly ascending order. An empty array
 *   says nothing about whether older history exists.
 * @throws {SymmError} when the body, values, or timestamp order are invalid.
 * @internal
 */
export function parseEnigmaOhlcv(data: unknown): Candle[] {
  if (typeof data !== "object" || data === null || !("result" in data) || !Array.isArray(data.result)) {
    throw new SymmError("api", "INVALID_ENIGMA_OHLCV_RESPONSE", "Price-service OHLCV response has no result array.");
  }

  let previousTime = Number.NEGATIVE_INFINITY;
  return data.result.map((entry: unknown, index: number) => {
    if (typeof entry !== "object" || entry === null) {
      throw new SymmError("api", "INVALID_ENIGMA_OHLCV_RESPONSE", `Invalid OHLCV candle at index ${index}.`);
    }

    const { timestamp, open, high, low, close, volume } = entry as Record<string, unknown>;
    if (
      !isFiniteNumber(timestamp) ||
      !Number.isSafeInteger(timestamp) ||
      !Number.isSafeInteger(timestamp * 1000) ||
      !isFiniteNumber(open) ||
      !isFiniteNumber(high) ||
      !isFiniteNumber(low) ||
      !isFiniteNumber(close) ||
      !isFiniteNumber(volume) ||
      volume < 0
    ) {
      throw new SymmError("api", "INVALID_ENIGMA_OHLCV_RESPONSE", `Invalid OHLCV values at index ${index}.`);
    }

    const time = timestamp * 1000;
    if (time <= previousTime) {
      throw new SymmError(
        "api",
        "INVALID_ENIGMA_OHLCV_RESPONSE",
        "Price-service OHLCV candle starts must be unique and ascending.",
      );
    }
    previousTime = time;
    return { time, open, high, low, close, volume };
  });
}
