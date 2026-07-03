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
 * Normalized price tick the SDK delivers to consumers. Currently mirrors the
 * raw frame 1:1; reserved for future enrichment (e.g. funding rate, index
 * price) once the backend ships them.
 */
export interface EnigmaPriceTick {
  /** Market symbol name (e.g. `"BTCUSDT"`). */
  name: string;
  /** Mark price as a decimal string. */
  markPrice: string;
  /** Source timestamp (unix ms), when present on the frame. */
  time?: number;
  /** Address of the underlying token / market, when present on the frame. */
  address?: string;
}
