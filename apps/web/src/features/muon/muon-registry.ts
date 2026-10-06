/** Which section of the Muon page a service card sits in. */
export type MuonGroup = "partyA" | "partyAB" | "prices";

/** Search/display metadata for one Muon service card. Pure data — no components — so the search index can import it without pulling card UI into its bundle. */
export interface MuonMethodMeta {
  /** Card `testId`, which is also its in-page anchor (`/muon#<id>`). */
  id: string;
  /** Wire method label shown on the card (and the search title). */
  method: string;
  /** Core SDK action that backs the card (a search keyword). */
  action: string;
  /** The page section the card belongs to. */
  group: MuonGroup;
  /** One line on what the card does, written for a search result. */
  summary: string;
}

/** The Muon page's sections, in display order. */
export const MUON_GROUPS: readonly { id: MuonGroup; label: string }[] = [
  { id: "partyA", label: "PartyA" },
  { id: "partyAB", label: "PartyA & PartyB" },
  { id: "prices", label: "Prices & settlement" },
];

/**
 * Every Muon service card, in display order. Single source of truth for both the
 * page grouping ({@link MuonShell}) and the command-palette search index — adding
 * a card here (plus its component in the shell's card map) lists it in both.
 */
export const MUON_METHODS: readonly MuonMethodMeta[] = [
  {
    id: "muon-uPnl_A",
    summary: "A partyA's unrealized-PnL attestation, as removing margin requires.",
    method: "uPnl_A",
    action: "getMuonUpnlA",
    group: "partyA",
  },
  {
    id: "muon-deallocate-upnl-sig",
    summary: "The uPnl_A attestation as the contract-ready SingleUpnlSig.",
    method: "uPnl_A → SingleUpnlSig",
    action: "getDeallocateUpnlSig",
    group: "partyA",
  },
  {
    id: "muon-partyA_overview",
    summary: "A partyA's liquidation overview, behind liquidatePartyA.",
    method: "partyA_overview",
    action: "getMuonPartyAOverview",
    group: "partyA",
  },
  {
    id: "muon-uPnl_A_withSymbolPrice",
    summary: "PartyA uPnL plus one symbol's price, for sending a quote.",
    method: "uPnl_A_withSymbolPrice",
    action: "getMuonUpnlAWithSymbolPrice",
    group: "partyA",
  },
  {
    id: "muon-send-quote-upnl-sig",
    summary: "The contract-ready signature for sending a quote.",
    method: "uPnl_A_withSymbolPrice → SingleUpnlAndPriceSig",
    action: "getSendQuoteUpnlSig",
    group: "partyA",
  },
  {
    id: "muon-uPnl_B",
    summary: "A partyB's uPnL against a partyA, for lockQuote.",
    method: "uPnl_B",
    action: "getMuonUpnlB",
    group: "partyAB",
  },
  {
    id: "muon-uPnl",
    summary: "Both parties' uPnL in one attestation.",
    method: "uPnl",
    action: "getMuonUpnl",
    group: "partyAB",
  },
  {
    id: "muon-uPnlWithSymbolPrice",
    summary: "Both parties' uPnL plus a symbol price, for openPosition.",
    method: "uPnlWithSymbolPrice",
    action: "getMuonUpnlWithSymbolPrice",
    group: "partyAB",
  },
  {
    id: "muon-price",
    summary: "Validated prices for a set of quotes, for partyB liquidation.",
    method: "price",
    action: "getMuonPrice",
    group: "prices",
  },
  {
    id: "muon-settle_upnl",
    summary: "uPnL settlement data for a partyA's quotes.",
    method: "settle_upnl",
    action: "getMuonSettleUpnl",
    group: "prices",
  },
  {
    id: "muon-priceRange",
    summary: "A price range over a window, for force-close validation.",
    method: "priceRange",
    action: "getMuonPriceRange",
    group: "prices",
  },
  {
    id: "muon-force-close-price-sig",
    summary: "The contract-ready force-close signature.",
    method: "priceRange → HighLowPriceSig",
    action: "getForceClosePriceSig",
    group: "prices",
  },
];
