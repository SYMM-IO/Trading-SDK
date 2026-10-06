import type { SearchCardMeta } from "../search/search-card-meta";

/**
 * Every card on the Price Service page, in display order — the command-palette
 * search metadata for {@link PriceServiceShell}, which places the cards itself. A
 * card added there must be listed here to be searchable; the coverage spec fails
 * until it is.
 */
export const PRICE_SERVICE_CARDS: readonly SearchCardMeta[] = [
  {
    id: "method-watchPrices",
    title: "watchPrices",
    kind: "read",
    section: "All providers",
    summary: "Live mark prices from whichever provider serves the selected solver.",
    keywords: ["usePrices", "mark price", "stream", "websocket"],
  },
  {
    id: "method-getMarkPrices",
    title: "getMarkPrices",
    kind: "read",
    section: "All providers",
    summary: "A one-shot mark-price snapshot from the selected solver's provider.",
    keywords: ["useMarkPrices", "mark price", "snapshot"],
  },
  {
    id: "method-getBinanceHealth",
    title: "getBinanceHealth",
    kind: "read",
    section: "Binance-only reads",
    summary: "Whether Binance USD-M Futures is reachable from this client.",
    keywords: ["useBinanceHealth", "Binance", "health", "status"],
  },
  {
    id: "method-getBinancePremiumIndex",
    title: "getBinancePremiumIndex",
    kind: "read",
    section: "Binance-only reads",
    summary: "Binance's mark price, index price and funding fields.",
    keywords: ["useBinancePremiumIndex", "Binance", "index price", "funding rate"],
  },
  {
    id: "method-getBinanceSymbolsInfo",
    title: "getBinanceSymbolsInfo",
    kind: "read",
    section: "Binance-only reads",
    summary: "Binance's contract listing, with price and quantity precision per symbol.",
    keywords: ["useBinanceSymbolsInfo", "Binance", "precision", "exchange info"],
  },
  {
    id: "method-watchBinancePrices",
    title: "watchBinancePrices",
    kind: "read",
    section: "Binance-only streams",
    summary: "Binance's all-market mark-price stream.",
    keywords: ["useBinancePrices", "Binance", "stream", "websocket"],
  },
  {
    id: "method-getEnigmaPriceServiceHealth",
    title: "getEnigmaPriceServiceHealth",
    kind: "read",
    section: "Enigma-only reads",
    summary: "The Enigma price service's health.",
    keywords: ["useEnigmaPriceServiceHealth", "Enigma", "health", "status"],
  },
  {
    id: "method-getEnigmaPriceServicePricesByAddresses",
    title: "getEnigmaPriceServicePricesByAddresses",
    kind: "read",
    section: "Enigma-only reads",
    summary: "Mark prices by token address.",
    keywords: ["useEnigmaPriceServicePricesByAddresses", "Enigma", "token address", "mark price"],
  },
  {
    id: "method-getEnigmaPriceServicePricesByNames",
    title: "getEnigmaPriceServicePricesByNames",
    kind: "read",
    section: "Enigma-only reads",
    summary: "Mark prices by market name.",
    keywords: ["useEnigmaPriceServicePricesByNames", "Enigma", "market name", "mark price"],
  },
  {
    id: "method-getEnigmaPriceServiceMetadata",
    title: "getEnigmaPriceServiceMetadata",
    kind: "read",
    section: "Enigma-only reads",
    summary: "Token metadata by address.",
    keywords: ["useEnigmaPriceServiceMetadata", "Enigma", "token metadata"],
  },
  {
    id: "method-getEnigmaPriceServiceSymbolsInfo",
    title: "getEnigmaPriceServiceSymbolsInfo",
    kind: "read",
    section: "Enigma-only reads",
    summary: "Every symbol the Enigma price service knows, with status and token address.",
    keywords: ["useEnigmaPriceServiceSymbolsInfo", "Enigma", "symbols"],
  },
  {
    id: "method-watchEnigmaPrices",
    title: "watchEnigmaPrices",
    kind: "read",
    section: "Enigma-only streams",
    summary: "Live mark prices from the Enigma price-service socket.",
    keywords: ["useEnigmaPrices", "Enigma", "stream", "websocket"],
  },
  {
    id: "method-watchEnigmaPriceByMarket",
    title: "watchEnigmaPriceByName",
    kind: "read",
    section: "Enigma-only streams",
    summary: "Stream one market's live mark price.",
    keywords: ["useEnigmaPriceByName", "useMarkets", "Enigma", "stream", "single market"],
  },
];
