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
  { id: "muon-uPnl_A", method: "uPnl_A", action: "getMuonUpnlA", group: "partyA" },
  { id: "muon-deallocate-upnl-sig", method: "uPnl_A → SingleUpnlSig", action: "getDeallocateUpnlSig", group: "partyA" },
  { id: "muon-partyA_overview", method: "partyA_overview", action: "getMuonPartyAOverview", group: "partyA" },
  {
    id: "muon-uPnl_A_withSymbolPrice",
    method: "uPnl_A_withSymbolPrice",
    action: "getMuonUpnlAWithSymbolPrice",
    group: "partyA",
  },
  {
    id: "muon-send-quote-upnl-sig",
    method: "uPnl_A_withSymbolPrice → SingleUpnlAndPriceSig",
    action: "getSendQuoteUpnlSig",
    group: "partyA",
  },
  { id: "muon-uPnl_B", method: "uPnl_B", action: "getMuonUpnlB", group: "partyAB" },
  { id: "muon-uPnl", method: "uPnl", action: "getMuonUpnl", group: "partyAB" },
  {
    id: "muon-uPnlWithSymbolPrice",
    method: "uPnlWithSymbolPrice",
    action: "getMuonUpnlWithSymbolPrice",
    group: "partyAB",
  },
  { id: "muon-price", method: "price", action: "getMuonPrice", group: "prices" },
  { id: "muon-settle_upnl", method: "settle_upnl", action: "getMuonSettleUpnl", group: "prices" },
  { id: "muon-priceRange", method: "priceRange", action: "getMuonPriceRange", group: "prices" },
  {
    id: "muon-force-close-price-sig",
    method: "priceRange → HighLowPriceSig",
    action: "getForceClosePriceSig",
    group: "prices",
  },
];
