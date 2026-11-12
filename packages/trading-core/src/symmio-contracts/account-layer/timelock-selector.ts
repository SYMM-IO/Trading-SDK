import { sliceHex, type Hex } from "viem";

/** @internal Normalize selector-or-calldata inputs to four-byte selectors. */
export function timelockSelectorOf(value: Hex): Hex {
  return value.length === 10 ? value : sliceHex(value, 0, 4);
}
