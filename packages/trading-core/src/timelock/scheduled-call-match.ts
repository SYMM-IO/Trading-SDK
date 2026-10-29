import { decodeFunctionData, isAddressEqual, type Address, type Hex } from "viem";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";

/** Check that a scheduled raw call is exactly the direct or single-Core-call execution payload. */
export function matchesScheduledCall(account: Address, rawCallData: Hex, innerCallData: Hex): boolean {
  if (!/^0x(?:[\da-fA-F]{2}){4,}$/.test(rawCallData) || !/^0x(?:[\da-fA-F]{2}){4,}$/.test(innerCallData)) return false;
  if (rawCallData.toLowerCase() === innerCallData.toLowerCase()) return true;
  try {
    const decoded = decodeFunctionData({ abi: accountLayerAbi, data: innerCallData });
    if (decoded.functionName !== "_call") return false;
    const [target, calls] = decoded.args;
    return (
      isAddressEqual(target, account) && calls.length === 1 && calls[0]?.toLowerCase() === rawCallData.toLowerCase()
    );
  } catch {
    return false;
  }
}
