import type { CodeLine } from "@/features/hero/code-pane";
import { BalancePanel } from "@/features/hero/panels/balance-panel";
import { ComposePanel } from "@/features/hero/panels/compose-panel";
import { OrderTicketPanel } from "@/features/hero/panels/order-ticket-panel";
import { PositionsPanel } from "@/features/hero/panels/positions-panel";
import type { ComponentType } from "react";

export interface HeroExample {
  id: string;
  /** Short name shown beside the carousel dots. */
  label: string;
  filename: string;
  lines: readonly CodeLine[];
  Panel: ComponentType;
}

/**
 * The hero carousel content — a few things you can build with the SDK, each a
 * hook snippet paired with the surface it renders. Illustrative, not exact
 * signatures (the site is presentational). Add an entry to extend the reel.
 */
export const heroExamples: HeroExample[] = [
  {
    id: "ticket",
    label: "Order ticket",
    filename: "ticket.tsx",
    Panel: OrderTicketPanel,
    lines: [
      [
        ["kw", "import"],
        ["plain", " { "],
        ["fn", "useMarket"],
        ["plain", " } "],
        ["kw", "from"],
        ["plain", " "],
        ["str", '"@symmio/trading-react"'],
        ["punct", ";"],
      ],
      [],
      [
        ["kw", "export function"],
        ["plain", " "],
        ["fn", "Ticket"],
        ["punct", "() {"],
      ],
      [
        ["plain", "  "],
        ["kw", "const"],
        ["plain", " { "],
        ["prop", "market"],
        ["punct", ", "],
        ["prop", "mark"],
        ["plain", " } = "],
        ["fn", "useMarket"],
        ["punct", "("],
        ["str", '"BTC-PERP"'],
        ["punct", ");"],
      ],
      [],
      [
        ["plain", "  "],
        ["kw", "return"],
        ["plain", " "],
        ["punct", "("],
      ],
      [
        ["plain", "    "],
        ["punct", "<"],
        ["tag", "OrderTicket"],
      ],
      [
        ["plain", "      "],
        ["prop", "symbol"],
        ["punct", "="],
        ["plain", "{"],
        ["prop", "market"],
        ["punct", "."],
        ["prop", "symbol"],
        ["plain", "}"],
      ],
      [
        ["plain", "      "],
        ["prop", "price"],
        ["punct", "="],
        ["plain", "{"],
        ["prop", "mark"],
        ["plain", "}"],
      ],
      [
        ["plain", "      "],
        ["prop", "maxLeverage"],
        ["punct", "="],
        ["plain", "{"],
        ["prop", "market"],
        ["punct", "."],
        ["prop", "maxLeverage"],
        ["plain", "}"],
      ],
      [
        ["plain", "    "],
        ["punct", "/>"],
      ],
      [
        ["plain", "  "],
        ["punct", ");"],
      ],
      [["punct", "}"]],
    ],
  },
  {
    id: "positions",
    label: "Open positions",
    filename: "positions.tsx",
    Panel: PositionsPanel,
    lines: [
      [
        ["kw", "import"],
        ["plain", " { "],
        ["fn", "usePositions"],
        ["plain", " } "],
        ["kw", "from"],
        ["plain", " "],
        ["str", '"@symmio/trading-react"'],
        ["punct", ";"],
      ],
      [],
      [
        ["kw", "export function"],
        ["plain", " "],
        ["fn", "Positions"],
        ["punct", "() {"],
      ],
      [
        ["plain", "  "],
        ["kw", "const"],
        ["plain", " { "],
        ["prop", "positions"],
        ["plain", " } = "],
        ["fn", "usePositions"],
        ["punct", "();"],
      ],
      [],
      [
        ["plain", "  "],
        ["kw", "return"],
        ["plain", " "],
        ["punct", "("],
      ],
      [
        ["plain", "    "],
        ["punct", "<"],
        ["tag", "PositionList"],
      ],
      [
        ["plain", "      "],
        ["prop", "rows"],
        ["punct", "="],
        ["plain", "{"],
        ["prop", "positions"],
        ["plain", "}"],
      ],
      [
        ["plain", "      "],
        ["prop", "onClose"],
        ["punct", "="],
        ["plain", "{("],
        ["prop", "id"],
        ["punct", ") => "],
        ["fn", "close"],
        ["punct", "("],
        ["prop", "id"],
        ["punct", ")}"],
      ],
      [
        ["plain", "    "],
        ["punct", "/>"],
      ],
      [
        ["plain", "  "],
        ["punct", ");"],
      ],
      [["punct", "}"]],
    ],
  },
  {
    id: "balance",
    label: "Account balance",
    filename: "balance.tsx",
    Panel: BalancePanel,
    lines: [
      [
        ["kw", "import"],
        ["plain", " { "],
        ["fn", "useAccount"],
        ["plain", " } "],
        ["kw", "from"],
        ["plain", " "],
        ["str", '"@symmio/trading-react"'],
        ["punct", ";"],
      ],
      [],
      [
        ["kw", "export function"],
        ["plain", " "],
        ["fn", "Balance"],
        ["punct", "() {"],
      ],
      [
        ["plain", "  "],
        ["kw", "const"],
        ["plain", " { "],
        ["prop", "equity"],
        ["punct", ", "],
        ["prop", "available"],
        ["plain", " } = "],
        ["fn", "useAccount"],
        ["punct", "();"],
      ],
      [],
      [
        ["plain", "  "],
        ["kw", "return"],
        ["plain", " "],
        ["punct", "("],
      ],
      [
        ["plain", "    "],
        ["punct", "<"],
        ["tag", "Collateral"],
      ],
      [
        ["plain", "      "],
        ["prop", "equity"],
        ["punct", "="],
        ["plain", "{"],
        ["prop", "equity"],
        ["plain", "}"],
      ],
      [
        ["plain", "      "],
        ["prop", "available"],
        ["punct", "="],
        ["plain", "{"],
        ["prop", "available"],
        ["plain", "}"],
      ],
      [
        ["plain", "    "],
        ["punct", "/>"],
      ],
      [
        ["plain", "  "],
        ["punct", ");"],
      ],
      [["punct", "}"]],
    ],
  },
  {
    id: "compose",
    label: "Build anything",
    filename: "compose.tsx",
    Panel: ComposePanel,
    lines: [
      [
        ["kw", "import"],
        ["punct", " {"],
      ],
      [
        ["plain", "  "],
        ["fn", "useMarket"],
        ["punct", ","],
      ],
      [
        ["plain", "  "],
        ["fn", "usePositions"],
        ["punct", ","],
      ],
      [
        ["plain", "  "],
        ["fn", "useAccount"],
        ["punct", ","],
      ],
      [
        ["punct", "} "],
        ["kw", "from"],
        ["plain", " "],
        ["str", '"@symmio/trading-react"'],
        ["punct", ";"],
      ],
      [],
      [
        ["kw", "export function"],
        ["plain", " "],
        ["fn", "AnyUI"],
        ["punct", "() {"],
      ],
      [
        ["plain", "  "],
        ["comment", "// any hooks, any layout — compose"],
      ],
      [
        ["plain", "  "],
        ["comment", "// the exact UI your product needs"],
      ],
      [],
      [
        ["plain", "  "],
        ["kw", "return"],
        ["plain", " "],
        ["punct", "<"],
        ["tag", "YourDesign"],
        ["punct", " />;"],
      ],
      [["punct", "}"]],
    ],
  },
];
