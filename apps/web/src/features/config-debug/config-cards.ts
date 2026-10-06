import type { SearchCardMeta } from "../search/search-card-meta";

/** The resolved-config sections render only for a chain the SDK supports; otherwise one notice card stands in. */
const SUPPORTED_CHAIN_GATE = "the connected chain is a supported SYMMIO chain";

/**
 * Every card on the Config page, in display order — the command-palette search
 * metadata for {@link SymmioConfigDebug}. A card added there must be listed here
 * to be searchable; the coverage spec fails until it is.
 */
export const CONFIG_CARDS: readonly SearchCardMeta[] = [
  {
    id: "config-runtime",
    title: "Runtime",
    kind: "read",
    summary: "The chain id and the solver the SDK resolved for it.",
    keywords: ["useSymmioConfig", "chain id", "solver", "solver address", "resolved config"],
    gate: SUPPORTED_CHAIN_GATE,
  },
  {
    id: "config-addresses",
    title: "Addresses",
    kind: "read",
    summary: "The resolved contract addresses and collateral decimals.",
    keywords: ["contract addresses", "Symmio", "Instant Layer", "Account Layer", "affiliate", "collateral"],
    gate: SUPPORTED_CHAIN_GATE,
  },
  {
    id: "config-subgraphs",
    title: "Subgraphs",
    kind: "read",
    summary: "The analytics subgraph URL.",
    keywords: ["subgraph", "analytics", "GraphQL"],
    gate: SUPPORTED_CHAIN_GATE,
  },
  {
    id: "config-notifications",
    title: "Notifications (default solver)",
    kind: "read",
    summary: "The default solver's notification socket and REST endpoints.",
    keywords: ["notifications", "websocket", "endpoint"],
    gate: SUPPORTED_CHAIN_GATE,
  },
];
