import {
  supportsEstimatedPrice,
  supportsTpSl,
  type Config,
  type SolverCapabilities,
  type SymmioSolverKind,
} from "@symmio/trading-core";

/**
 * One answer in the capability matrix.
 *
 * `yes` / `no` render as a check or a dash; `value` renders a short monospace
 * answer for the questions whose answer is not a boolean (how many operations
 * an instant open signs, which kind of Muon signature it carries).
 */
export type CapabilityCell =
  | { kind: "yes"; detail?: string }
  | { kind: "no"; detail?: string }
  | { kind: "value"; label: string; detail?: string };

/** Everything a capability row is allowed to look at. All of it comes from the SDK. */
export interface CapabilityContext {
  /** The live SDK config from `useSymmioConfig()`. */
  config: Config;
  /** Chain being asked about. */
  chainId: number;
  /** Solver kind as `config.getSolver({ chainId, solverId }).id` reports it. */
  solverId: SymmioSolverKind;
  /** Result of `useSolverCapabilities({ chainId, solverId })`. */
  capabilities: SolverCapabilities;
}

/** One question in the capability matrix. */
export interface CapabilityRow {
  /** Stable row key. */
  id: string;
  /** The question, phrased as a feature. */
  label: string;
  /** The SDK symbol that answers it, shown verbatim as a monospace caption. */
  source: string;
  /** One line of honest detail about what the answer means. */
  note: string;
  /** Compute the answer for one deployment. Runs on every render — it is a config read, not a fetch. */
  resolve: (context: CapabilityContext) => CapabilityCell;
}

/**
 * The capability matrix, as questions rather than as a table of answers.
 *
 * Not one boolean in this file is written down: every `resolve` asks the SDK at
 * render time. That is deliberate — a matrix typed by hand would be a claim,
 * and this screen exists to show the claims being answered by the same calls a
 * consuming app would make.
 *
 * Where no SDK gate exists for a question, the row says so in `source` instead
 * of inventing one.
 */
export const CAPABILITY_ROWS: readonly CapabilityRow[] = [
  {
    id: "charting",
    label: "Charting",
    source: 'market.kind === "enigma" ? pool metadata : CandleSource',
    note: "Deliberately not a yes/no. Every market SYMMIO lists can be charted — the routes differ. A listed market has bars, so the SDK's Binance CandleSource streams them. A pool-traded market has none, but useEnigmaPriceServiceMetadata resolves its chain_id + pair_address, which is what a pool indexer needs. Reading 'no CandleSource' as 'no chart' is the mistake this row exists to prevent.",
    resolve: ({ solverId }) =>
      solverId === "enigma"
        ? { kind: "value", label: "pool-indexed", detail: "chain_id + pair_address → pool chart" }
        : { kind: "value", label: "candle-source", detail: "Binance USD-M bars via useCandles" },
  },
  {
    id: "tpsl",
    label: "Take-profit / stop-loss",
    source: "supportsTpSl(config, { chainId, solverId })",
    note: "True only when the solver declares a conditional-order handler block in its config.",
    resolve: ({ config, chainId, solverId }) =>
      supportsTpSl(config, { chainId, solverId }) ? { kind: "yes" } : { kind: "no" },
  },
  {
    id: "group-close",
    label: "Group close (market + side)",
    source: "useSolverCapabilities().groupClose",
    note: "Folding a market + side cohort into one close is only defined where that cohort is a real on-chain unit.",
    resolve: ({ capabilities }) => (capabilities.groupClose ? { kind: "yes" } : { kind: "no" }),
  },
  {
    id: "estimated-price",
    label: "Estimated price",
    source: "supportsEstimatedPrice(config, { chainId, solverId })",
    note: "GET /estimated-price is an Enigma route; the SDK ships a boolean gate so you never call it and catch.",
    resolve: ({ config, chainId, solverId }) =>
      supportsEstimatedPrice(config, { chainId, solverId }) ? { kind: "yes" } : { kind: "no" },
  },
  {
    id: "notional-cap-list",
    label: "Notional-cap list",
    source: 'config.getSolver().id === "enigma"',
    note: "GET /notional_cap (the list form) is documented Enigma-only, but no supportsX gate ships for it — this row derives the answer from the resolved solver kind.",
    resolve: ({ solverId }) => (solverId === "enigma" ? { kind: "yes" } : { kind: "no" }),
  },
  {
    id: "rasa-only",
    label: "Rasa-only solver reads",
    source: 'assertSolverKind(solver, "rasa")',
    note: "readyz, balance_info, party-a-upnl, open_interest, price-range, error_codes and the two whitelist calls all throw UNSUPPORTED_BY_SOLVER on a non-Rasa solver.",
    resolve: ({ solverId }) => (solverId === "rasa" ? { kind: "yes" } : { kind: "no" }),
  },
  {
    id: "virtual-accounts",
    label: "Virtual Accounts per market + side",
    source: 'config.getSolver().id === "enigma"',
    note: "The Enigma instant-open adapter funds a fresh Virtual Account in the same batch; Rasa is cross-margin on the sub-account and allocates none.",
    resolve: ({ solverId }) => (solverId === "enigma" ? { kind: "yes" } : { kind: "no" }),
  },
  {
    id: "instant-open-ops",
    label: "Operations signed per instant open",
    source: "instantOpen(config, …) adapter for config.getSolver().id",
    note: "Enigma signs addMarginToNextVA on the AccountLayer plus sendQuote on the diamond; Rasa signs sendQuote alone.",
    resolve: ({ solverId }) =>
      solverId === "enigma"
        ? { kind: "value", label: "2", detail: "addMarginToNextVA + sendQuote" }
        : { kind: "value", label: "1", detail: "sendQuote" },
  },
  {
    id: "upnl-sig",
    label: "Muon uPnL signature on open",
    source: "instantOpen(config, …) adapter for config.getSolver().id",
    note: "Rasa enforces Muon verification, so the quote carries a live attestation; Enigma carries a placeholder whose byte range is delegated to the solver as a flex field.",
    resolve: ({ solverId }) =>
      solverId === "enigma"
        ? { kind: "value", label: "placeholder", detail: "flex-field delegation" }
        : { kind: "value", label: "live", detail: "fetched before signing" },
  },
];
