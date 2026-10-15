import type { useEnigmaPriceServiceSymbolsInfo, useMarkets } from "@symmio/trading-react";
import { ALL_PAGES, getContractPage } from "../contracts/pages";
import { METHOD_REGISTRY, type AbiKey } from "../contracts/registry";
import { GASLESS_METHODS } from "../gasless/gasless-methods";
import { flowSearchEntryId, INTEGRATION_CONSOLE_ID, INTEGRATION_FLOWS } from "../integration/integration-flows";
import { navLinks } from "../layout/nav";
import { MUON_GROUPS, MUON_METHODS } from "../muon/muon-registry";
import { SOLVER_METHODS } from "../solvers/solver-methods";
import { CARD_CATALOG } from "./card-catalog";
import { splitHref, type SearchEntry } from "./search-entry";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];
type SymbolRow = NonNullable<ReturnType<typeof useEnigmaPriceServiceSymbolsInfo>["data"]>[number];

/** Human-readable contract names, used as match keywords. */
const ABI_LABEL: Record<AbiKey, string> = {
  "account-layer": "AccountLayer",
  "symmio-core": "SYMMIO Core",
  collateral: "Collateral",
  "instant-layer": "InstantLayer",
};

/** The navigation's name for a route, so a card's location reads as the menu does. */
function pageName(href: string): string {
  return navLinks.find((link) => link.href === href)?.label ?? href;
}

/**
 * Every Contracts method card, deep-linked to its card on its ABI page — or, for
 * an off-chain read with no ABI, its first flow page.
 */
function contractCardEntries(): SearchEntry[] {
  return METHOD_REGISTRY.map((entry) => {
    const pageSlug = entry.abi ?? entry.groups[0];
    const contractPage = pageSlug ? getContractPage(pageSlug) : undefined;
    const abiLabel = entry.abi ? ABI_LABEL[entry.abi] : "Off-chain API";
    return {
      id: `method:${entry.id}`,
      type: "card",
      title: entry.title ?? entry.id,
      subtitle: entry.summary,
      kind: entry.kind,
      keywords: [...(entry.title ? [entry.id] : []), entry.kind, abiLabel, ...entry.groups],
      href: pageSlug ? `/contracts/${pageSlug}#method-${entry.id}` : "/contracts",
      location: { page: pageName("/contracts"), section: contractPage?.title },
    };
  });
}

/** Each Muon service card, deep-linked to its anchor on the Muon page. */
function muonCardEntries(): SearchEntry[] {
  return MUON_METHODS.map((method) => ({
    id: `muon:${method.id}`,
    type: "card",
    title: method.method,
    subtitle: method.summary,
    kind: "read",
    keywords: [method.action, "muon", "oracle", "signature", "off-chain api"],
    href: `/muon#${method.id}`,
    location: {
      page: pageName("/muon"),
      section: MUON_GROUPS.find((group) => group.id === method.group)?.label,
    },
  }));
}

/** Each Solvers-page method card, deep-linked to its anchor on the Solvers page. */
function solverCardEntries(): SearchEntry[] {
  return SOLVER_METHODS.map((method) => ({
    id: `solver:${method.id}`,
    type: "card",
    title: method.method,
    subtitle: method.summary,
    kind: method.kind,
    keywords: [method.action, ...(method.aliases ?? []), "solver", "off-chain api"],
    href: `/solvers#${method.id}`,
    location: { page: pageName("/solvers"), section: method.section },
  }));
}

/** Each Gasless-page card, deep-linked to its anchor on the Gasless page. */
function gaslessCardEntries(): SearchEntry[] {
  return GASLESS_METHODS.map((method) => ({
    id: `gasless:${method.id}`,
    type: "card",
    title: method.method,
    subtitle: method.summary,
    kind: method.kind,
    keywords: [method.action, ...(method.aliases ?? []), "gasless", "relayer", "off-chain api"],
    href: `/gasless#${method.id}`,
    location: { page: pageName("/gasless") },
  }));
}

/** Every card in {@link CARD_CATALOG} — the pages whose cards have no registry of their own. */
function catalogCardEntries(): SearchEntry[] {
  return Object.entries(CARD_CATALOG).flatMap(([href, cards]) =>
    cards.map(
      (card): SearchEntry => ({
        id: `card:${href}#${card.id}`,
        type: "card",
        title: card.title,
        subtitle: card.summary,
        kind: card.kind,
        keywords: [...card.keywords, ...(card.section ? [card.section] : [])],
        href: `${href}#${card.id}`,
        location: { page: pageName(href), section: card.section },
      }),
    ),
  );
}

/**
 * Each Integration flow, opening the console on that flow (`?flow=`) and landing
 * on it. The console is one card holding every flow, so the flows are what
 * search lists.
 */
function integrationFlowEntries(): SearchEntry[] {
  return INTEGRATION_FLOWS.map((flow) => ({
    id: flowSearchEntryId(flow.id),
    type: "flow",
    title: flow.label,
    subtitle: flow.summary,
    keywords: [...flow.keywords, "integration"],
    href: `/integration?flow=${flow.id}#${INTEGRATION_CONSOLE_ID}`,
    location: { page: pageName("/integration") },
  }));
}

/** Every searchable card in the app, from each page's registry or catalog. */
function cardEntries(): SearchEntry[] {
  return [
    ...contractCardEntries(),
    ...muonCardEntries(),
    ...solverCardEntries(),
    ...gaslessCardEntries(),
    ...catalogCardEntries(),
  ];
}

/**
 * Top-level navigation destinations, each with how many searchable cards or
 * flows live under it — a page's own, and its sub-pages' for a section like
 * Contracts.
 */
function routeEntries(destinations: readonly SearchEntry[]): SearchEntry[] {
  return navLinks.map((link) => {
    const under = destinations.filter((entry) => {
      const { pathname } = splitHref(entry.href);
      return pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
    });
    return {
      id: `route:${link.href}`,
      type: "route",
      title: link.label,
      subtitle: link.description ?? link.href,
      keywords: [],
      href: link.href,
      cardCount: under.filter((entry) => entry.type === "card").length,
      flowCount: under.filter((entry) => entry.type === "flow").length,
    };
  });
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
    location: { page: pageName("/contracts") },
  }));
}

/** Every card and console flow — the destinations that live inside a page. */
const IN_PAGE_ENTRIES = [...cardEntries(), ...integrationFlowEntries()];

/** Static entries that never change at runtime — built once at module load. */
export const STATIC_ENTRIES: readonly SearchEntry[] = [
  ...routeEntries(IN_PAGE_ENTRIES),
  ...pageEntries(),
  ...IN_PAGE_ENTRIES,
];

/** Solver markets, fetched lazily when the palette opens. Routes to the Solvers page. */
export function marketEntries(markets: readonly Market[]): SearchEntry[] {
  return markets.map((market) => ({
    id: `market:${market.symbolId}`,
    type: "market",
    title: market.symbol || String(market.symbolId),
    subtitle: market.name || undefined,
    keywords: [String(market.symbolId)],
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
