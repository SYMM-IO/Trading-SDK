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
  const outerSelector = sliceHex(callData, 0, 4).toLowerCase() as Hex;
  if (outerSelector !== EXECUTE_TIMELOCK_SELECTOR) return [outerSelector];

  try {
    const outer = decodeFunctionData({ abi: accountLayerAbi, data: callData });
    if (outer.functionName !== "executeTimelockOp") return [outerSelector];
    return [sliceHex(outer.args[1], 0, 4).toLowerCase() as Hex];
  } catch {
    // Malformed calldata will be rejected later by normal encoding/simulation.
    // Keeping the outer selector here avoids granting authority inferred from
    // bytes that could not be decoded canonically.
    return [outerSelector];
  }
}
