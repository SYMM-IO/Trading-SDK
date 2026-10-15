import { CANDLES_CARDS } from "../candles/candles-cards";
import { CONFIG_CARDS } from "../config-debug/config-cards";
import type { NavHref } from "../layout/nav";
import { ORDERBOOK_CARDS } from "../orderbook/orderbook-cards";
import { POOLS_CARDS } from "../pools/pools-cards";
import { PRICE_SERVICE_CARDS } from "../price-service/price-service-cards";
import { SESSION_KEY_CARDS } from "../session-keys/session-key-cards";
import type { SearchCardMeta } from "./search-card-meta";

/**
 * Routes whose cards are indexed from a registry the page itself renders from or
 * keeps beside it — Contracts (`METHOD_REGISTRY`), Muon, Solvers, Gasless — or
 * that hold no cards to index but a console of flows (Integration).
 */
type RegistryHref = "/contracts" | "/muon" | "/solvers" | "/gasless" | "/integration";

/**
 * Search metadata for every other page's cards, keyed by route. Keyed by every
 * header destination, so a new page fails to compile until it is listed here —
 * an empty list included, for a page with no cards.
 */
export const CARD_CATALOG: Record<Exclude<NavHref, RegistryHref>, readonly SearchCardMeta[]> = {
  "/": [],
  "/pools": POOLS_CARDS,
  "/price-service": PRICE_SERVICE_CARDS,
  "/candles": CANDLES_CARDS,
  "/orderbook": ORDERBOOK_CARDS,
  "/config": CONFIG_CARDS,
  "/session-keys": SESSION_KEY_CARDS,
};
