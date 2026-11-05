import { decodeFunctionData, sliceHex, toFunctionSelector, type Hex } from "viem";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";

const EXECUTE_TIMELOCK_SELECTOR = toFunctionSelector(
  accountLayerAbi.find((item) => item.type === "function" && item.name === "executeTimelockOp")!,
).toLowerCase() as Hex;

/**
 * Resolve the InstantLayer delegation authority exercised by one AccountLayer call.
 * `executeTimelockOp` is transparent for delegation: the permission belongs to
 * its immediate inner AccountLayer entry point (`_call` for Core operations),
 * not to the outer wrapper or the raw Core selector.
 *
 * @internal
 */
export function getEffectiveInstantSelectors(callData: Hex): readonly Hex[] {
  let current = callData;
  for (;;) {
    const selector = sliceHex(current, 0, 4).toLowerCase() as Hex;
    if (selector !== EXECUTE_TIMELOCK_SELECTOR) return [selector];
    try {
      const decoded = decodeFunctionData({ abi: accountLayerAbi, data: current });
      if (decoded.functionName !== "executeTimelockOp") return [selector];
      current = decoded.args[1];
    } catch {
      // Malformed calldata will be rejected later by normal encoding/simulation.
      // Keeping the current selector avoids granting authority inferred from
      // bytes that could not be decoded canonically.
      return [selector];
    }
  }
}
