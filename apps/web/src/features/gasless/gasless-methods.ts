/**
 * Search/display metadata for one Gasless-page card. Pure data — no components —
 * so the command-palette search index can import it without pulling card UI into
 * its bundle.
 */
export interface GaslessMethodMeta {
  /** Card `testId`, which is also its in-page anchor (`/gasless#<id>`). */
  id: string;
  /** Method or hook shown as the card title (and the search title). */
  method: string;
  /** SDK action that backs the card (a search keyword). */
  action: string;
  /**
   * Read/write, judged by the card's most consequential action rather than by its
   * title: a card that reads a value and also offers the write that changes it counts
   * as a write. Drives both the card chip ({@link GaslessCard}) and its search row.
   */
  kind: "read" | "write";
  /** Secondary SDK symbols and terms the card also demonstrates, kept searchable. */
  aliases?: string[];
}

/**
 * Every Gasless-page card, in display order. Single source of truth for both the
 * page layout ({@link GaslessShell}) and the command-palette search index —
 * adding a card here (plus its component in the shell's card map) lists it in both.
 */
export const GASLESS_METHODS: readonly GaslessMethodMeta[] = [
  {
    id: "gasless-service",
    method: "supportsGaslessService",
    action: "useSupportsGaslessService",
    kind: "read",
    aliases: ["gaslessLayer", "availability", "execution mode", "relayer"],
  },
  {
    id: "gasless-allowance",
    method: "getOperationalFeeAllowance",
    action: "useOperationalFeeAllowance",
    kind: "write",
    aliases: ["approveOperationalFee", "useApproveOperationalFee", "operational fee", "allowance"],
  },
  {
    id: "gasless-request",
    method: "useGaslessRequest",
    action: "getGaslessRequest",
    kind: "read",
    aliases: ["waitForGaslessRequest", "request status", "polling"],
  },
  {
    id: "gasless-deposit",
    method: "getGaslessDepositPolicy",
    action: "useGaslessDepositPolicy",
    kind: "write",
    aliases: ["settleGaslessDepositNewAccount", "useSettleGaslessDepositNewAccount", "deposit address", "onboarding"],
  },
];
