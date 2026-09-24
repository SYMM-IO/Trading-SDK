/**
 * The three ways a consumer can drive the SDK's writes, and the prerequisites
 * each one needs before the trading flows work.
 *
 * The tracks are **cumulative**, not alternatives: `gasless` is `wallet` plus a
 * fee allowance, and `session-key` is `gasless` plus a delegated browser key.
 * That ordering is forced by the contracts — the relayer charges its fee from
 * the sub-account's SYMMIO collateral against a diamond-side allowance, and a
 * session key can only ever sign through the relayer — so a shorter track is
 * always a prefix of a longer one and switching never discards finished work.
 */
export type SetupTrack = "wallet" | "gasless" | "session-key";

/** One step in a track's ladder. `ready` is the terminus, not a prerequisite. */
export type SetupStepId =
  | "connect"
  | "account"
  | "collateral"
  | "fee-allowance"
  | "session-key"
  | "delegation"
  | "ready";

/** How one track is presented in the picker. */
export interface SetupTrackInfo {
  value: SetupTrack;
  label: string;
  /** What signs, and who pays the gas. */
  tagline: string;
  /** The trade-off a reader needs to choose between the three. */
  detail: string;
  /** `true` for the tracks that need the chain to carry a gasless relayer. */
  needsRelayer: boolean;
}

/** The tracks in ascending order of setup cost, which is also ascending capability. */
export const SETUP_TRACKS: readonly SetupTrackInfo[] = [
  {
    value: "wallet",
    label: "Wallet only",
    tagline: "Your wallet signs every action and pays native gas.",
    detail:
      "The baseline. Nothing to set up beyond an account with collateral in it, and every write raises a wallet prompt.",
    needsRelayer: false,
  },
  {
    value: "gasless",
    label: "Gasless",
    tagline: "Your wallet signs, the relayer broadcasts and pays the gas.",
    detail:
      "One extra prerequisite — an operational-fee allowance — and writes stop needing native gas. The prompt stays: the wallet still signs each operation.",
    needsRelayer: true,
  },
  {
    value: "session-key",
    label: "Session key",
    tagline: "A browser-local key signs, the relayer pays the gas. No prompts.",
    detail:
      "Everything gasless needs, plus a key and one delegation grant. After that grant the key signs on its own — no wallet prompt, no native gas.",
    needsRelayer: true,
  },
];

/** The step ladder for one track, in the order the contracts force. */
export function getSetupStepIds(track: SetupTrack): readonly SetupStepId[] {
  if (track === "wallet") return ["connect", "account", "collateral", "ready"];
  if (track === "gasless") return ["connect", "account", "collateral", "fee-allowance", "ready"];
  return ["connect", "account", "collateral", "fee-allowance", "session-key", "delegation", "ready"];
}

/** The rail's title for each step. */
export const SETUP_STEP_LABELS: Readonly<Record<SetupStepId, string>> = {
  connect: "Connect wallet",
  account: "Sub-account",
  collateral: "Collateral",
  "fee-allowance": "Fee allowance",
  "session-key": "Session key",
  delegation: "Delegation",
  ready: "Ready to trade",
};
