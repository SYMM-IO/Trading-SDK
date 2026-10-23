import { VIRTUAL_ACCOUNT_ISOLATION_TYPE, type VirtualAccountIsolationType } from "@symmio/trading-react";

/** One Virtual Account isolation type: its value, its contract name, and how it groups positions. */
export interface VirtualAccountIsolationOption {
  value: VirtualAccountIsolationType;
  label: string;
  hint: string;
}

/** Every Virtual Account isolation type, in enum order, named as the contract names it. */
export const VIRTUAL_ACCOUNT_ISOLATION_OPTIONS: readonly VirtualAccountIsolationOption[] = [
  { value: VIRTUAL_ACCOUNT_ISOLATION_TYPE.POSITION, label: "POSITION", hint: "Each position in its own VA." },
  { value: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET, label: "MARKET", hint: "One market's positions, both sides." },
  { value: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG, label: "MARKET_LONG", hint: "One market's long positions." },
  { value: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT, label: "MARKET_SHORT", hint: "One market's short positions." },
];

/**
 * The contract's name for a Virtual Account isolation type.
 *
 * @param isolation - The on-chain enum value.
 * @returns Its enum member name, or `UNKNOWN` for a value this app predates.
 */
export function labelForIsolation(isolation: VirtualAccountIsolationType): string {
  return VIRTUAL_ACCOUNT_ISOLATION_OPTIONS.find((option) => option.value === isolation)?.label ?? "UNKNOWN";
}
