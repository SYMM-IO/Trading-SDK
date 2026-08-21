import { SymmioSupportedChainId, type SymmioSolverKind } from "@symmio/trading-core";

/**
 * A market family — the user-facing name for one SYMMIO deployment.
 *
 * The SDK models a deployment as a `(chainId, solverId)` pair. Prism gives each
 * pair an identity: a palette, a label, and a story. `unified` is not a
 * deployment — it is the merged view over all of them.
 */
export type MarketFamily = "majors" | "lowcaps";

/** The global palette mode. `unified` shows every family at once. */
export type PrismMode = "unified" | MarketFamily;

/**
 * One SYMMIO deployment, plus the branding Prism hangs off it.
 *
 * The SDK's own solver config carries only a `name` ("Rasa" / "Enigma"), so the
 * palette, blurb and chain label live here rather than in `symmioConfig`.
 */
export interface Deployment {
  /** Stable key used for tagging merged rows and for URL/query state. */
  readonly family: MarketFamily;
  /** The chain this deployment's solver lives on. */
  readonly chainId: SymmioSupportedChainId;
  /** The solver kind. In the shipped registry, one solver per chain. */
  readonly solverId: SymmioSolverKind;
  /** Short product name shown in chips and headers. */
  readonly label: string;
  /** The solver's own name, as the SDK reports it. */
  readonly solverName: string;
  /** Public id shown in solver pills, e.g. `majors-v2`. */
  readonly solverTag: string;
  /** Human chain name for chain pills. */
  readonly chainName: string;
  /** CSS custom property holding this chain's brand hex. */
  readonly chainColorVar: string;
  /** Tier-1 token prefix: `mj` or `lc`. Drives every branded surface. */
  readonly tone: "mj" | "lc";
  /** One line explaining what trades here. */
  readonly blurb: string;
}

/**
 * Every deployment Prism merges into one surface.
 *
 * This is the whole multi-solver configuration. Every data hook in the app is
 * mounted once per entry with an explicit `{ chainId, solverId }`, and the
 * results are merged with a `family` tag. Adding a third market family means
 * adding a row here — no screen changes.
 */
export const DEPLOYMENTS: readonly Deployment[] = [
  {
    family: "majors",
    chainId: SymmioSupportedChainId.BASE,
    solverId: "rasa",
    label: "Majors",
    solverName: "Rasa",
    solverTag: "majors-v2",
    chainName: "Base",
    chainColorVar: "--chain-base",
    tone: "mj",
    blurb: "Deep-liquidity perps on listed assets — BTC, ETH, SOL — priced off Binance USD-M futures.",
  },
  {
    family: "lowcaps",
    chainId: SymmioSupportedChainId.HYPER_EVM,
    solverId: "enigma",
    label: "Lowcaps",
    solverName: "Enigma",
    solverTag: "lowcap-v0",
    chainName: "HyperEVM",
    chainColorVar: "--chain-hyperevm",
    tone: "lc",
    blurb: "Microcap and memecoin perps with no exchange listing, priced from their own liquidity pools.",
  },
] as const;

/** Look up a deployment by its market family. Never returns undefined. */
export function getDeployment(family: MarketFamily): Deployment {
  const found = DEPLOYMENTS.find((deployment) => deployment.family === family);
  if (!found) {
    throw new Error(`Unknown market family: ${family}`);
  }
  return found;
}

/** Look up the deployment that owns a chain, if Prism merges that chain. */
export function getDeploymentByChainId(chainId: number): Deployment | undefined {
  return DEPLOYMENTS.find((deployment) => deployment.chainId === chainId);
}

/**
 * The deployments a given mode should read from.
 *
 * `unified` fans out over every deployment; a family mode narrows to one. This
 * is the only place the mode affects *data* — everywhere else it is pure color.
 */
export function deploymentsForMode(mode: PrismMode): readonly Deployment[] {
  return mode === "unified" ? DEPLOYMENTS : [getDeployment(mode)];
}

/**
 * Per-family palette, resolved to the tier-1 primitives in `globals.css`.
 *
 * A market's color is a fact about that market, so it stays constant even in
 * unified mode — cyan is BTC's identity whatever the app accent is.
 */
export const FAMILY_PALETTE: Record<MarketFamily, { base: string; soft: string; border: string }> = {
  majors: { base: "var(--mj-500)", soft: "var(--mj-bg)", border: "var(--mj-bd)" },
  lowcaps: { base: "var(--lc-500)", soft: "var(--lc-bg)", border: "var(--lc-bd)" },
};
