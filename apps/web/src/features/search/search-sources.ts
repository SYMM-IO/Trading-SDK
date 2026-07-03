import type { useEnigmaPriceServiceSymbolsInfo, useMarkets } from "@symmio/trading-react";
import { ALL_PAGES } from "../contracts/pages";
import { METHOD_REGISTRY, type AbiKey } from "../contracts/registry";
import { navLinks } from "../layout/nav";
import { MUON_METHODS } from "../muon/muon-registry";
import { SOLVER_METHODS } from "../solvers/solver-methods";
import type { SearchEntry } from "./search-entry";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];
type SymbolRow = NonNullable<ReturnType<typeof useEnigmaPriceServiceSymbolsInfo>["data"]>[number];

/** Human-readable contract names, used for method subtitles and match keywords. */
const ABI_LABEL: Record<AbiKey, string> = {
  "account-layer": "AccountLayer",
  "symmio-core": "SYMMIO Core",
  collateral: "Collateral",
  "instant-layer": "InstantLayer",
};

/** Top-level navigation destinations. */
function routeEntries(): SearchEntry[] {
  return navLinks.map((link) => ({
    id: `route:${link.href}`,
    type: "route",
    title: link.label,
    subtitle: link.description ?? link.href,
    keywords: [],
    href: link.href,
  }));
}

/**
 * Each Contracts sub-page. ABI pages are tagged `contract`; flow pages — which
 * gather related methods rather than wrapping one contract — are tagged `flow`.
 */
function pageEntries(): SearchEntry[] {
  return ALL_PAGES.map((page) => ({
    id: `page:${page.slug}`,
    type: page.kind === "abi" ? "contract" : "flow",
    title: page.title,
    subtitle: page.description,
    keywords: [page.eyebrow, page.kind, page.abi ?? page.group ?? ""].filter(Boolean),
    href: `/contracts/${page.slug}`,
  }));
}

/** Every registered contract method, deep-linked to its card on the ABI page. */
function methodEntries(): SearchEntry[] {
  return METHOD_REGISTRY.map((entry) => {
    const abiLabel = entry.abi ? ABI_LABEL[entry.abi] : "Off-chain API";
    const pageSlug = entry.abi ?? entry.groups[0];
    return {
      id: `method:${entry.id}`,
      type: "method",
      title: entry.id,
      subtitle: abiLabel,
      kind: entry.kind,
      keywords: [entry.kind, abiLabel, ...entry.groups],
      href: pageSlug ? `/contracts/${pageSlug}#method-${entry.id}` : "/contracts",
    };
  });
}

/** Each Muon service card, deep-linked to its anchor on the Muon page. */
function muonMethodEntries(): SearchEntry[] {
  return MUON_METHODS.map((method) => ({
    id: `muon:${method.id}`,
    type: "method",
    title: method.method,
    subtitle: "Muon API",
    kind: "read",
    keywords: [method.action, "muon", "oracle", "off-chain api"],
    href: `/muon#${method.id}`,
  }));
}

/** Each Solvers-page method card, deep-linked to its anchor on the Solvers page. */
function solverMethodEntries(): SearchEntry[] {
  return SOLVER_METHODS.map((method) => ({
    id: `solver:${method.id}`,
    type: "method",
    title: method.method,
    subtitle: "Solver API",
    kind: method.kind,
    keywords: [method.action, "solver", "off-chain api"],
    href: `/solvers#${method.id}`,
  }));
}

/** Static entries that never change at runtime — built once at module load. */
export const STATIC_ENTRIES: readonly SearchEntry[] = [
  ...routeEntries(),
  ...pageEntries(),
  ...methodEntries(),
  ...muonMethodEntries(),
  ...solverMethodEntries(),
];

/** Solver markets, fetched lazily when the palette opens. Routes to the Solvers page. */
export function marketEntries(markets: readonly Market[]): SearchEntry[] {
  return markets.map((market) => ({
    id: `market:${market.symbol_id}`,
    type: "market",
    title: market.symbol ?? String(market.symbol_id),
    subtitle: market.name ?? undefined,
    keywords: [String(market.symbol_id)],
    href: "/solvers",
  }));
}

/** Price-service symbol listings, fetched lazily. Routes to the Price Service page. */
export function symbolEntries(symbols: readonly SymbolRow[]): SearchEntry[] {
  return symbols.map((symbol) => ({
    id: `symbol:${symbol.address}`,
    type: "symbol",
    title: symbol.name,
    subtitle: String(symbol.status),
    keywords: [symbol.address],
    href: "/price-service",
  }));
}
