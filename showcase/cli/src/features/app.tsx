import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useDeployment } from "../config/deployment-context.js";
import { theme } from "../config/theme.js";
import { AccountScreen } from "./account/account-screen.js";
import { ActivityScreen } from "./activity/activity-screen.js";
import { AnalyticsScreen } from "./analytics/analytics-screen.js";
import { TABS, useAppState, type TabKey } from "./app-state.js";
import { GaslessScreen } from "./gasless/gasless-screen.js";
import { MarketsScreen } from "./markets/markets-screen.js";
import { OverlayHost } from "./overlays/overlay-host.js";
import { PoolsScreen } from "./pools/pools-screen.js";
import { PositionsScreen } from "./positions/positions-screen.js";
import { StatusBar, type KeyHint } from "./status-bar.js";
import { SystemScreen } from "./system/system-screen.js";
import { ToastHost } from "./toast.js";
import { TopBar } from "./top-bar.js";
import { TradeScreen } from "./trade/trade-screen.js";

const TAB_HINTS: Record<TabKey, KeyHint[]> = {
  markets: [
    { key: "/", label: "search" },
    { key: "↑↓", label: "browse" },
    { key: "⏎", label: "trade" },
  ],
  trade: [
    { key: "↑↓", label: "fields" },
    { key: "←→", label: "adjust" },
    { key: "⏎", label: "submit/pick" },
  ],
  positions: [
    { key: "↑↓", label: "select" },
    { key: "c/g/m/t", label: "close/group/margin/tp-sl" },
    { key: "a/C", label: "manage/close all" },
    { key: "r", label: "refresh" },
  ],
  account: [
    { key: "↑↓", label: "select" },
    { key: "⏎", label: "open" },
  ],
  activity: [
    { key: "v", label: "view" },
    { key: "↑↓", label: "select" },
    { key: "n/p", label: "page" },
    { key: "f", label: "filter" },
    { key: "r", label: "refresh" },
  ],
  analytics: [
    { key: "←→", label: "market" },
    { key: "/", label: "search" },
    { key: "[ ]", label: "timeframe" },
    { key: "s", label: "probe size" },
    { key: "r", label: "refresh" },
  ],
  pools: [
    { key: "↑↓", label: "select" },
    { key: "v", label: "catalog/mine" },
    { key: "s", label: "status filter" },
    { key: "d", label: "detail section" },
    { key: "n/p", label: "page" },
    { key: "a/o", label: "sign in/out" },
    { key: "r", label: "refresh" },
  ],
  gasless: [
    { key: "[ ]", label: "section" },
    { key: ", .", label: "wallet" },
    { key: "↑↓", label: "focus" },
    { key: "r", label: "refresh" },
  ],
  system: [{ key: "r", label: "refresh" }],
};

const GLOBAL_HINTS: KeyHint[] = [
  { key: "e", label: "environment" },
  { key: "w", label: "wallet" },
  { key: "?", label: "help" },
  { key: "q", label: "quit" },
];

/** The app shell: top chrome, the active screen or overlay, toasts, status bar. */
export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { tab, setTab, overlay, openOverlay, closeOverlay, textEditing } = useAppState();
  const { environment, cycleDeployment, cycleEnvironment } = useDeployment();

  useInput((input, key) => {
    if (key.escape) {
      if (overlay) closeOverlay();
      return;
    }
    if (overlay) return;
    // With no overlay open, Tab always cycles tabs — even while typing in a
    // field or searching, since it is never a meaningful text character here.
    const currentIndex = TABS.findIndex((entry) => entry.key === tab);
    if (key.tab) {
      const delta = key.shift ? -1 : 1;
      setTab(TABS[(currentIndex + delta + TABS.length) % TABS.length]!.key);
      return;
    }
    // The remaining single-key shortcuts are suspended while a text field or
    // search box is capturing input.
    if (textEditing) return;
    if (input === "q") {
      exit();
      return;
    }
    if (input === "w") {
      openOverlay({ kind: "wallet" });
      return;
    }
    if (input === "x") {
      cycleDeployment();
      return;
    }
    if (input === "e") {
      cycleEnvironment();
      return;
    }
    if (input === "?") {
      openOverlay({ kind: "help" });
      return;
    }
    const numeric = Number(input);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= TABS.length) {
      setTab(TABS[numeric - 1]!.key);
    }
  });

  // A 0/undefined column count means the width is unknown (non-TTY, pipe) —
  // assume it is wide enough rather than blocking the UI.
  const width = stdout?.columns && stdout.columns > 0 ? stdout.columns : 100;
  if (width < 80) {
    return (
      <Box padding={1}>
        <Text color={theme.warning}>Terminal too narrow — widen to at least 80 columns.</Text>
      </Box>
    );
  }

  const active = overlay === null;
  const editingHints: KeyHint[] =
    tab === "gasless"
      ? [
          { key: "[ ]", label: "section" },
          { key: "↑↓", label: "leave field" },
          { key: "⏎", label: "submit" },
        ]
      : [
          { key: "↑↓", label: "leave field" },
          { key: "⏎", label: "submit" },
        ];

  return (
    <Box flexDirection="column" width="100%">
      <TopBar />
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingTop={1} minHeight={18}>
        {overlay ? (
          <OverlayHost overlay={overlay} />
        ) : (
          <>
            {tab === "markets" && <MarketsScreen active={active} />}
            {tab === "trade" && <TradeScreen active={active} />}
            {tab === "positions" && <PositionsScreen active={active} />}
            {tab === "account" && <AccountScreen active={active} />}
            {tab === "activity" && <ActivityScreen active={active} />}
            {tab === "analytics" && <AnalyticsScreen active={active} />}
            {tab === "pools" && <PoolsScreen active={active} />}
            {tab === "gasless" && <GaslessScreen active={active} />}
            {tab === "system" && <SystemScreen active={active} />}
          </>
        )}
      </Box>
      <ToastHost />
      <StatusBar
        hints={
          overlay
            ? []
            : textEditing
              ? editingHints
              : [
                  ...(TAB_HINTS[tab] ?? []),
                  ...(environment === "production" ? [{ key: "x", label: "chain" }] : []),
                  ...GLOBAL_HINTS,
                ]
        }
      />
    </Box>
  );
}
