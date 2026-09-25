import type { QuoteGroup, UnifiedQuote } from "@symmio/trading-core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useDeployment } from "../config/deployment-context.js";
import type { TabDef } from "../ui/tabs.js";

/** The top-level product surfaces, ordered to follow the trading journey. */
export const TABS: readonly TabDef[] = [
  { key: "markets", label: "Markets" },
  { key: "trade", label: "Trade" },
  { key: "positions", label: "Positions" },
  { key: "account", label: "Account" },
  { key: "activity", label: "Activity" },
  { key: "analytics", label: "Analytics" },
  { key: "pools", label: "Pools" },
  { key: "gasless", label: "Gasless" },
  { key: "system", label: "System" },
];

export type TabKey = (typeof TABS)[number]["key"];

/** A modal overlay — a wallet/collateral sheet or a per-position action. */
export type Overlay =
  | { kind: "wallet" }
  | { kind: "market-picker"; startSearching?: boolean }
  | { kind: "subaccount" }
  | { kind: "deposit" }
  | { kind: "allocate" }
  | { kind: "withdraw" }
  | { kind: "enable-trading" }
  | { kind: "help" }
  | { kind: "order-actions"; quote: UnifiedQuote }
  | { kind: "close-all"; quotes: UnifiedQuote[] }
  | { kind: "group-close"; group: QuoteGroup }
  | { kind: "close"; quote: UnifiedQuote }
  | { kind: "margin"; quote: UnifiedQuote }
  | { kind: "tpsl"; quote: UnifiedQuote };

interface AppStateValue {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  overlay: Overlay | null;
  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;
  /** The market of interest, shared between Markets and Trade. */
  marketId: number | null;
  setMarketId: (id: number) => void;
  /** True while a text input is being edited — suspends global shortcuts. */
  textEditing: boolean;
  setTextEditing: (editing: boolean) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

/** Holds the active tab, the single open overlay, and the text-editing flag. */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const { deployment, environment } = useDeployment();
  const [tab, setTab] = useState<TabKey>("markets");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [marketId, setMarketId] = useState<number | null>(null);
  const [textEditing, setTextEditing] = useState(false);

  const openOverlay = useCallback((next: Overlay) => setOverlay(next), []);
  const closeOverlay = useCallback(() => {
    setOverlay(null);
    setTextEditing(false);
  }, []);

  useEffect(() => {
    setMarketId(null);
    setOverlay(null);
    setTextEditing(false);
  }, [deployment.id, environment]);

  const value = useMemo<AppStateValue>(
    () => ({ tab, setTab, overlay, openOverlay, closeOverlay, marketId, setMarketId, textEditing, setTextEditing }),
    [tab, overlay, openOverlay, closeOverlay, marketId, textEditing],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/** Access tab / overlay / text-editing state. */
export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used within AppStateProvider.");
  return value;
}
