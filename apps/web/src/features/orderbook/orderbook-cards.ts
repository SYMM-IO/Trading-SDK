import type { SearchCardMeta } from "../search/search-card-meta";

/**
 * Every card on the Orderbook page — the command-palette search metadata for
 * {@link OrderbookShell}. A card added there must be listed here to be
 * searchable; the coverage spec fails until it is.
 */
export const ORDERBOOK_CARDS: readonly SearchCardMeta[] = [
  {
    id: "method-useLiveOrderbook",
    title: "useLiveOrderbook",
    kind: "read",
    section: "Market depth",
    summary: "A live, synchronized order book, grouped onto a tick and accumulated.",
    keywords: ["useBinanceOrderbookSource", "order book", "depth", "bids", "asks"],
  },
];
