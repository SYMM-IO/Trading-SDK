/**
 * Raw price frame as it arrives on the Enigma lowcap price WS. The endpoint
 * broadcasts an array of these per message; one entry per market.
 *
 * `markPrice` arrives as a JSON number on the wire (the SDK normalizes it to
 * a decimal string in {@link EnigmaPriceTick}).
 */
export interface RawEnigmaPriceFrame {
  name: string;
  markPrice: number;
  /** Optional source timestamp (unix ms). */
  time?: number;
  /** Optional address of the underlying token / market. */
  address?: string;
}

/**
 * Normalized price tick from either broadcast or legacy single-symbol frames.
 * Identity, index price and funding fields are present only when supplied by
 * the feed; the SDK does not infer them from a potentially ambiguous ticker.
 */
export interface EnigmaPriceTick {
  /** Protocol identity when explicitly carried by the feed. */
  symbolId?: number;
  /** Display ticker for legacy single-symbol frames (not a unique identity). */
  symbol?: string;
  /** Optional index price and funding rate supplied by the feed. */
  indexPrice?: string;
  fundingRate?: string;
  /** Market symbol name (e.g. `"BTCUSDT"`). */
  name: string;
  /** Mark price as a decimal string. */
  markPrice: string;
  /** Source timestamp (unix ms), when present on the frame. */
  time?: number;
  /** Address of the underlying token / market, when present on the frame. */
  address?: string;
}
