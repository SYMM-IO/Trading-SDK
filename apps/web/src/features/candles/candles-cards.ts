import type { SearchCardMeta } from "../search/search-card-meta";

/**
 * Every card on the Candles page, in display order — the command-palette search
 * metadata for {@link CandlesShell}. A card added there must be listed here to be
 * searchable; the coverage spec fails until it is.
 */
export const CANDLES_CARDS: readonly SearchCardMeta[] = [
  {
    id: "method-useCandles",
    title: "useCandles + useCandleStream",
    kind: "read",
    section: "Chart data",
    summary: "Historical bars with live updates merged on, drawn as a chart.",
    keywords: ["useCandles", "useCandleStream", "useBinanceCandleSource", "candles", "OHLCV", "klines", "chart"],
  },
  {
    id: "method-useEnigmaPriceServiceMetadata-chart",
    title: "useEnigmaPriceServiceMetadata → DexScreener",
    kind: "read",
    section: "Chart data",
    summary: "Chart a lowcap market from its liquidity pool.",
    keywords: ["useEnigmaPriceServiceMetadata", "useEnigmaPriceServiceSymbolsInfo", "DexScreener", "lowcap chart"],
  },
];
